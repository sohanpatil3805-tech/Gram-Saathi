"""
Secure document storage service for Gram Saathi.
Implements:
1. Content-based MIME inspection (magic bytes).
2. Strict size limits (max 5 MB).
3. UUID-based private disk filenames (never exposes original filenames or public URLs).
4. Path traversal prevention.
5. Database metadata persistence.
6. Access control checking (citizen owner or authorized officer).
"""
from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import UploadedDocument, Citizen, Officer

ALLOWED_MAGIC_SIGNATURES: Dict[str, Tuple[bytes, str, str]] = {
    "pdf": (b"%PDF-", "application/pdf", ".pdf"),
    "jpeg": (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    "png": (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
}


class DocumentSecurityError(Exception):
    """Raised when an uploaded document violates security, validation, or size rules."""
    pass


class DocumentNotFoundError(Exception):
    """Raised when a requested document does not exist in the database or filesystem."""
    pass


class DocumentAccessDeniedError(Exception):
    """Raised when an unauthorized user attempts to view or download a document."""
    pass


class StorageService:
    @staticmethod
    def inspect_content(file_bytes: bytes) -> Tuple[str, str, str]:
        """
        Inspect magic bytes at beginning of file.
        Returns (format_name, mime_type, standard_extension).
        Raises DocumentSecurityError if file type is unsupported or malicious.
        """
        if not file_bytes:
            raise DocumentSecurityError("Uploaded file is empty.")

        for fmt, (magic, mime, ext) in ALLOWED_MAGIC_SIGNATURES.items():
            if file_bytes.startswith(magic):
                return fmt, mime, ext

        raise DocumentSecurityError(
            "Unsupported file type. Allowed formats are PDF, JPEG, and PNG. "
            "File header does not match expected signatures."
        )

    @staticmethod
    def validate_size(file_bytes: bytes) -> None:
        """Enforce maximum upload size limit."""
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise DocumentSecurityError(
                f"File size ({len(file_bytes) / (1024*1024):.2f} MB) exceeds maximum allowed limit "
                f"of {settings.max_upload_size_mb} MB."
            )

    @classmethod
    def save_document(
        cls,
        db: Session,
        citizen_id: uuid.UUID,
        original_filename: str,
        file_bytes: bytes,
        document_type: str = "other",
        application_id: Optional[uuid.UUID] = None,
    ) -> UploadedDocument:
        """
        Validate, hash, and persist document to private storage and database.
        Prevents path traversal and replaces filename with UUID.
        """
        # 1. Enforce size limit
        cls.validate_size(file_bytes)

        # 2. Inspect real magic bytes
        fmt, mime_type, ext = cls.inspect_content(file_bytes)

        # 3. Compute SHA-256 hash
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        # 4. Generate UUID server-side filename
        doc_uuid = uuid.uuid4()
        stored_filename = f"{doc_uuid}{ext}"

        # 5. Prevent path traversal
        storage_dir = settings.storage_documents_dir.resolve()
        target_path = (storage_dir / stored_filename).resolve()

        if not str(target_path).startswith(str(storage_dir)):
            raise DocumentSecurityError("Path traversal attempt detected.")

        # 6. Sanitize original filename (keep base name only)
        safe_original_name = Path(original_filename).name or f"document{ext}"

        # 7. Write to private disk
        with open(target_path, "wb") as f:
            f.write(file_bytes)

        # Relative path from project root or storage dir
        relative_path = str(target_path.relative_to(settings.PROJECT_ROOT if hasattr(settings, "PROJECT_ROOT") else storage_dir.parent))

        # 8. Create database record
        doc_record = UploadedDocument(
            id=doc_uuid,
            citizen_id=citizen_id,
            application_id=application_id,
            document_type=document_type,
            original_filename=safe_original_name,
            stored_filename=stored_filename,
            file_path=relative_path,
            file_size_bytes=len(file_bytes),
            mime_type=mime_type,
            sha256_hash=sha256_hash,
            ocr_status="pending",
            ocr_extracted_fields={},
            validation_status="pending",
            is_verified=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(doc_record)
        db.commit()
        db.refresh(doc_record)
        return doc_record

    @classmethod
    def get_document_file(
        cls,
        db: Session,
        document_id: uuid.UUID,
        requesting_citizen_id: Optional[uuid.UUID] = None,
        requesting_officer_id: Optional[uuid.UUID] = None,
    ) -> Tuple[UploadedDocument, Path]:
        """
        Retrieve document and verify access permissions.
        Requires requesting_citizen_id == document.citizen_id OR valid requesting_officer_id.
        """
        doc = db.query(UploadedDocument).filter_by(id=document_id).first()
        if not doc:
            raise DocumentNotFoundError(f"Document {document_id} not found.")

        # Access control
        is_owner = requesting_citizen_id is not None and doc.citizen_id == requesting_citizen_id
        is_officer = False
        if requesting_officer_id is not None:
            officer = db.query(Officer).filter_by(id=requesting_officer_id, is_active=True).first()
            if officer:
                is_officer = True

        if not (is_owner or is_officer):
            raise DocumentAccessDeniedError("Access denied: You do not have permission to view this document.")

        # Verify disk path
        storage_dir = settings.storage_documents_dir.resolve()
        target_path = (storage_dir / doc.stored_filename).resolve()

        if not str(target_path).startswith(str(storage_dir)) or not target_path.exists():
            raise DocumentNotFoundError("Document file not found on disk.")

        return doc, target_path
