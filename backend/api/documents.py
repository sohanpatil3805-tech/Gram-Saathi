"""
Secure document management endpoints for Gram Saathi.
Enforces content-based MIME inspection, size limits, private storage,
and IDOR-protected download authorization.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import UploadedDocument
from backend.services.storage_service import (
    StorageService,
    DocumentSecurityError,
    DocumentNotFoundError,
    DocumentAccessDeniedError,
)
from backend.auth.security import get_current_user_payload
from backend.api.schemas import DocumentResponse, DocumentConfirmRequest
from backend.config import settings
from backend.services.ocr_service import ocr_service
from backend.services.audit_service import AuditService

logger = logging.getLogger(__name__)

documents_router = APIRouter(prefix="/documents", tags=["documents"])


def _to_document_response(doc: UploadedDocument) -> DocumentResponse:
    is_confirmed = bool(doc.confirmed_at or doc.citizen_confirmed_fields)
    return DocumentResponse(
        id=doc.id,
        citizen_id=doc.citizen_id,
        application_id=doc.application_id,
        document_type=doc.document_type,
        original_filename=doc.original_filename,
        stored_filename=doc.stored_filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        sha256_hash=doc.sha256_hash,
        ocr_status=doc.ocr_status or "pending",
        extracted_fields=doc.ocr_extracted_fields or {},
        confidence_score=doc.ocr_confidence,
        ocr_text=doc.ocr_text,
        confirmed_fields=doc.citizen_confirmed_fields,
        is_confirmed_by_user=is_confirmed,
        confirmation_notes=doc.confirmation_notes,
        validation_status=doc.validation_status or "PENDING",
        created_at=doc.created_at,
    )


@documents_router.get("/ocr-status")
async def get_ocr_status():
    """
    Returns Tesseract engine availability, configured binary path,
    available language packs, and active configured languages.
    """
    avail_langs = ocr_service.get_available_languages()
    configured_langs = ocr_service.tesseract_languages
    effective_langs = ocr_service.resolve_effective_languages(configured_langs)
    return {
        "engine_available": ocr_service.is_engine_available(),
        "resolved_tesseract_cmd": ocr_service.tesseract_cmd,
        "available_languages": avail_langs,
        "configured_languages": configured_langs,
        "effective_languages": effective_langs,
    }


@documents_router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    citizen_id: uuid.UUID = Form(...),
    document_type: str = Form("other"),
    application_id: Optional[uuid.UUID] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    try:
        doc = StorageService.save_document(
            db=db,
            citizen_id=citizen_id,
            original_filename=file.filename or "uploaded_document",
            file_bytes=file_bytes,
            document_type=document_type,
            application_id=application_id,
        )
    except DocumentSecurityError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        storage_dir = settings.storage_documents_dir.resolve()
        disk_path = storage_dir / doc.stored_filename
        ocr_result = ocr_service.process_document(file_path=disk_path, document_type=doc.document_type)
        doc.ocr_status = ocr_result.ocr_status
        doc.ocr_extracted_fields = ocr_result.extracted_fields
        doc.ocr_confidence = ocr_result.confidence
        doc.ocr_text = ocr_result.extracted_text
        if ocr_result.ocr_status == "success":
            doc.validation_status = "VALID"
        elif ocr_result.ocr_status == "low_confidence":
            doc.validation_status = "NEEDS_CORRECTION"
            if ocr_result.warnings:
                doc.validation_notes = "; ".join(ocr_result.warnings)
        db.commit()
        db.refresh(doc)
    except Exception as e:
        logger.warning(f"OCR processing failed for document {doc.id}: {e}")
        doc.ocr_status = "failed"
        try:
            db.commit()
            db.refresh(doc)
        except Exception:
            pass

    return _to_document_response(doc)


@documents_router.post("/{document_id}/confirm", response_model=DocumentResponse)
async def confirm_document_fields(
    document_id: uuid.UUID,
    payload: DocumentConfirmRequest,
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """
    Citizen confirmation & correction workflow for extracted OCR fields.
    Updates citizen_confirmed_fields, sets confirmed_at, marks is_verified=True,
    and logs the verification audit event.
    """
    doc = db.query(UploadedDocument).filter(UploadedDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.citizen_id != payload.citizen_id:
        raise HTTPException(status_code=403, detail="Document does not belong to the specified citizen.")

    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            if sub and uuid.UUID(str(sub)) != payload.citizen_id:
                raise HTTPException(status_code=403, detail="Citizen ID mismatch with authenticated session.")

    doc.citizen_confirmed_fields = payload.confirmed_fields
    doc.confirmation_notes = payload.notes
    doc.confirmed_at = datetime.now(timezone.utc)
    doc.is_verified = True
    doc.validation_status = "CONFIRMED"

    AuditService.log(
        db=db,
        action="CONFIRM_DOCUMENT_OCR",
        actor_type="citizen",
        actor_id=payload.citizen_id,
        target_entity="document",
        target_id=doc.id,
        details={
            "document_type": doc.document_type,
            "confirmed_keys": list(payload.confirmed_fields.keys()),
        },
    )

    db.commit()
    db.refresh(doc)
    return _to_document_response(doc)


@documents_router.get("/{document_id}/metadata", response_model=DocumentResponse)
def get_document_metadata(
    document_id: uuid.UUID,
    citizen_id: Optional[uuid.UUID] = Query(None),
    officer_id: Optional[uuid.UUID] = Query(None),
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Retrieve document metadata with ownership or officer authorization."""
    req_citizen_id = citizen_id
    req_officer_id = officer_id
    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            token_citizen_id = uuid.UUID(str(sub))
            if req_citizen_id and req_citizen_id != token_citizen_id:
                raise HTTPException(status_code=403, detail="Citizen ID mismatch with token.")
            req_citizen_id = token_citizen_id
        elif user_type == "officer" or auth_user.get("role"):
            sub = auth_user.get("sub") or auth_user.get("officer_id")
            if sub:
                try:
                    req_officer_id = uuid.UUID(str(sub))
                except ValueError:
                    pass

    try:
        doc, _ = StorageService.get_document_file(
            db=db,
            document_id=document_id,
            requesting_citizen_id=req_citizen_id,
            requesting_officer_id=req_officer_id,
        )
    except DocumentNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found.")
    except DocumentAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return _to_document_response(doc)


@documents_router.get("/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    citizen_id: Optional[uuid.UUID] = Query(None),
    officer_id: Optional[uuid.UUID] = Query(None),
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """
    Secure document download endpoint.
    Only authorized citizen owner or assigned officer can download.
    Never exposes internal filesystem paths.
    """
    req_citizen_id = citizen_id
    req_officer_id = officer_id
    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            token_citizen_id = uuid.UUID(str(sub))
            if req_citizen_id and req_citizen_id != token_citizen_id:
                raise HTTPException(status_code=403, detail="Citizen ID mismatch with token.")
            req_citizen_id = token_citizen_id
        elif user_type == "officer" or auth_user.get("role"):
            sub = auth_user.get("sub") or auth_user.get("officer_id")
            if sub:
                try:
                    req_officer_id = uuid.UUID(str(sub))
                except ValueError:
                    pass

    try:
        doc, disk_path = StorageService.get_document_file(
            db=db,
            document_id=document_id,
            requesting_citizen_id=req_citizen_id,
            requesting_officer_id=req_officer_id,
        )
    except DocumentNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found.")
    except DocumentAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return FileResponse(
        path=str(disk_path),
        filename=doc.original_filename,
        media_type=doc.mime_type,
    )
