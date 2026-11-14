"""
Application draft management, status state machine, confirmation token,
and officer review endpoints for Gram Saathi.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.services.application_service import (
    ApplicationService,
    ApplicationError,
    ApplicationNotFoundError,
    ApplicationStateTransitionError,
    ApplicationAccessDeniedError,
)
from backend.services.token_service import TokenService
from backend.services.notification_service import notify_status_change
from backend.schemes.repository import SchemeRepository
from backend.schemes.eligibility import evaluate_scheme, Outcome
from backend.db.models import Application, Citizen, AuditLog, UploadedDocument
from backend.auth.security import (
    get_current_user_payload,
    get_current_officer,
    get_current_citizen,
)
from backend.api.schemas import (
    ApplicationDraftCreateRequest,
    ApplicationDraftUpdateRequest,
    ApplicationSubmitRequest,
    ApplicationResponse,
    ApplicationStatusHistoryResponse,
    TokenRequest,
    TokenResponse,
    OfficerDecisionRequest,
    OfficerDecisionNewRequest,
    TimelineItemResponse,
)

applications_router = APIRouter(tags=["applications"])


def _build_application_response(
    app: Application,
    db: Session,
    repo: Optional[SchemeRepository] = None,
) -> ApplicationResponse:
    if repo is None:
        repo = SchemeRepository()
        try:
            repo.load()
        except Exception:
            pass

    citizen_name = None
    citizen_phone_masked = None
    citizen_village = app.jurisdiction_village
    citizen_district = app.jurisdiction_district
    citizen_state = "Karnataka"
    citizen_group = None

    if app.citizen:
        citizen_name = app.citizen.name
        if app.citizen.phone_number:
            digits = re.sub(r"\D", "", app.citizen.phone_number)
            last4 = digits[-4:] if len(digits) >= 4 else digits
            citizen_phone_masked = f"+91 XXXXX X{last4}"
        citizen_village = citizen_village or app.citizen.village
        citizen_district = citizen_district or app.citizen.district
        citizen_state = app.citizen.state or citizen_state
        citizen_group = app.citizen.citizen_group

    if not citizen_name and app.applicant_data:
        citizen_name = (
            app.applicant_data.get("full_name")
            or app.applicant_data.get("farmer_name")
            or app.applicant_data.get("name")
        )
    if not citizen_village and app.applicant_data:
        citizen_village = app.applicant_data.get("village")
    if not citizen_district and app.applicant_data:
        citizen_district = app.applicant_data.get("district")

    # Fetch official scheme record
    scheme = None
    scheme_name = app.scheme_id
    scheme_category = None
    scheme_department = None
    try:
        scheme = repo.get_scheme(app.scheme_id)
        if scheme and isinstance(scheme, dict):
            raw_name = scheme.get("name_en") or scheme.get("name") or app.scheme_id
            if isinstance(raw_name, dict):
                scheme_name = str(raw_name.get("en") or raw_name.get("kn") or next(iter(raw_name.values()), app.scheme_id))
            elif isinstance(raw_name, str):
                scheme_name = raw_name
            scheme_category = scheme.get("category")
            scheme_department = scheme.get("department")
    except Exception:
        pass

    # Infer or align citizen group
    if not citizen_group and app.applicant_data:
        citizen_group = app.applicant_data.get("citizen_group") or app.applicant_data.get("beneficiary_group")
    if not citizen_group and scheme:
        bg = scheme.get("beneficiary_groups") or []
        if "students" in bg:
            citizen_group = "STUDENT"
        elif "farmers" in bg:
            citizen_group = "FARMER"
        elif "women_entrepreneurs" in bg:
            citizen_group = "WOMAN_ENTREPRENEUR"
        elif "workers" in bg:
            citizen_group = "WAGE_WORKER"

    # Load and link documents
    docs = db.query(UploadedDocument).filter_by(application_id=app.id).all()
    if not docs and app.applicant_data and app.applicant_data.get("document_ids"):
        raw_ids = app.applicant_data.get("document_ids") or []
        valid_uuids = []
        for rid in raw_ids:
            try:
                valid_uuids.append(uuid.UUID(str(rid)))
            except (ValueError, TypeError):
                pass
        if valid_uuids:
            docs = db.query(UploadedDocument).filter(UploadedDocument.id.in_(valid_uuids)).all()
            for d in docs:
                if not d.application_id:
                    d.application_id = app.id
            try:
                db.commit()
            except Exception:
                pass

    if not docs and app.citizen_id:
        unlinked = db.query(UploadedDocument).filter(
            UploadedDocument.citizen_id == app.citizen_id,
            UploadedDocument.application_id.is_(None)
        ).all()
        if unlinked:
            for u in unlinked:
                u.application_id = app.id
            try:
                db.commit()
                docs = unlinked
            except Exception:
                pass

    docs_list = [
        {
            "id": str(d.id),
            "document_type": d.document_type,
            "original_filename": d.original_filename,
            "file_size_bytes": d.file_size_bytes,
            "mime_type": d.mime_type,
            "sha256_hash": d.sha256_hash,
            "ocr_status": d.ocr_status or d.validation_status or "VERIFIED",
            "ocr_confidence": d.ocr_confidence,
            "ocr_extracted_fields": d.ocr_extracted_fields or {},
            "ocr_text": d.ocr_text,
            "citizen_confirmed_fields": d.citizen_confirmed_fields,
            "is_confirmed_by_user": bool(d.confirmed_at or d.citizen_confirmed_fields),
            "confirmation_notes": d.confirmation_notes,
            "confirmed_at": d.confirmed_at.isoformat() if d.confirmed_at else None,
            "validation_status": d.validation_status or "VALID",
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]

    # Deterministic eligibility evaluation from scheme's actual rules
    eligibility_evaluation = None
    eligibility_score = 50
    if scheme:
        eval_res = evaluate_scheme(scheme, app.applicant_data or {})
        eval_dict = eval_res.to_dict()
        total_rules = len(eval_res.rule_results)
        passed_rules = sum(1 for r in eval_res.rule_results if r.outcome == Outcome.POTENTIALLY_ELIGIBLE)
        failed_rules = sum(1 for r in eval_res.rule_results if r.outcome == Outcome.NOT_ELIGIBLE)
        
        if failed_rules > 0:
            eligibility_score = 0
        elif total_rules > 0:
            eligibility_score = int(round((passed_rules / total_rules) * 100))
        else:
            eligibility_score = 50
        
        eval_dict["score"] = eligibility_score
        eligibility_evaluation = eval_dict

    # Build scheme-specific required documents checklist
    checklist = []
    if scheme:
        raw_reqs = scheme.get("required_documents") or []
        uploaded_types = {d.document_type.lower(): d for d in docs}
        
        for item in raw_reqs:
            if isinstance(item, dict):
                item_name = item.get("item") or item.get("name") or "Required Document"
                mandatory = item.get("mandatory", True)
                note = item.get("note") or ""
            else:
                item_name = str(item)
                mandatory = True
                note = ""
            
            matched_doc = None
            for dtype, udoc in uploaded_types.items():
                in_lower = item_name.lower()
                if (dtype in in_lower or
                    ("aadhaar" in dtype and "aadhaar" in in_lower) or
                    ("caste" in dtype and ("caste" in in_lower or "rd number" in in_lower)) or
                    ("income" in dtype and "income" in in_lower) or
                    ("marks" in dtype and ("marks" in in_lower or "score" in in_lower)) or
                    ("passbook" in dtype and ("bank" in in_lower or "passbook" in in_lower)) or
                    ("land" in dtype and ("land" in in_lower or "rtc" in in_lower or "pahani" in in_lower)) or
                    ("college" in dtype and ("college" in in_lower or "student id" in in_lower or "study" in in_lower)) or
                    ("kutumba" in in_lower and "kutumba" in dtype)):
                    matched_doc = udoc
                    break
            
            checklist.append({
                "item_name": item_name,
                "mandatory": mandatory,
                "note": note,
                "is_uploaded": matched_doc is not None,
                "uploaded_doc_id": str(matched_doc.id) if matched_doc else None,
                "uploaded_filename": matched_doc.original_filename if matched_doc else None,
                "uploaded_file_size": matched_doc.file_size_bytes if matched_doc else None,
                "validation_status": matched_doc.validation_status if matched_doc else "PENDING",
                "ocr_status": matched_doc.ocr_status if matched_doc else None,
                "confidence_score": matched_doc.ocr_confidence if matched_doc else None,
            })

    # Load timeline
    timeline_list = []
    logs = db.query(AuditLog).filter_by(target_entity="application", target_id=app.id).order_by(AuditLog.created_at.asc()).all()
    for log in logs:
        timeline_list.append({
            "timestamp": log.created_at.isoformat() if log.created_at else datetime.now(timezone.utc).isoformat(),
            "status": log.action,
            "actor": f"{log.actor_type or 'system'}",
            "notes": (log.details.get("notes") if isinstance(log.details, dict) else str(log.details)) or log.action,
        })
    if not timeline_list and app.status_history:
        for h in app.status_history:
            timeline_list.append({
                "timestamp": h.created_at.isoformat() if h.created_at else datetime.now(timezone.utc).isoformat(),
                "status": h.to_status,
                "actor": h.changed_by,
                "notes": h.remarks or h.to_status,
            })

    return ApplicationResponse(
        id=app.id,
        citizen_id=app.citizen_id,
        scheme_id=app.scheme_id,
        scheme_name=scheme_name,
        scheme_category=scheme_category,
        scheme_department=scheme_department,
        current_status=app.current_status,
        submission_mode=app.submission_mode,
        progress_percentage=app.progress_percentage,
        applicant_data=app.applicant_data or {},
        submission_reference=app.submission_reference,
        submitted_at=app.submitted_at,
        rejection_reason=app.rejection_reason,
        official_order_number=app.official_order_number,
        is_simulated=app.is_simulated,
        created_at=app.created_at,
        updated_at=app.updated_at,
        citizen_name=citizen_name,
        citizen_phone_masked=citizen_phone_masked,
        citizen_village=citizen_village,
        citizen_district=citizen_district,
        citizen_state=citizen_state,
        citizen_group=citizen_group,
        documents=docs_list,
        timeline=timeline_list,
        eligibility_evaluation=eligibility_evaluation,
        eligibility_score=eligibility_score,
        required_documents_checklist=checklist,
    )


@applications_router.get("/applications", response_model=List[ApplicationResponse])
def list_applications(
    status: Optional[str] = Query(None),
    scheme_id: Optional[str] = Query(None),
    citizen_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> List[ApplicationResponse]:
    """
    List applications.
    - If called with citizen JWT, return only that citizen's applications.
    - If called with officer JWT, return all (with filters: status, scheme_id, page, limit).
    - If called with citizen_id query param (fallback), filter by that citizen.
    """
    query = db.query(Application)

    is_officer = False
    req_citizen_id = citizen_id

    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            if sub:
                try:
                    req_citizen_id = uuid.UUID(str(sub))
                except ValueError:
                    pass
        elif user_type == "officer" or auth_user.get("role"):
            is_officer = True

    if not is_officer and req_citizen_id:
        query = query.filter(Application.citizen_id == req_citizen_id)
    elif not is_officer and not req_citizen_id:
        # Default for anonymous or unauthenticated request without citizen filter:
        # Require authentication to list applications
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to list applications.",
        )

    if status:
        query = query.filter(Application.current_status == status)
    if scheme_id:
        query = query.filter(Application.scheme_id == scheme_id)

    offset = (page - 1) * limit
    apps = query.order_by(Application.created_at.desc()).offset(offset).limit(limit).all()

    repo = SchemeRepository()
    try:
        repo.load()
    except Exception:
        pass

    return [_build_application_response(a, db, repo) for a in apps]



@applications_router.post("/applications/drafts", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application_draft(
    payload: ApplicationDraftCreateRequest,
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """Create a new application draft for a verified scheme."""
    repo = SchemeRepository()
    try:
        repo.load()
    except Exception:
        pass

    try:
        app = ApplicationService.create_draft(
            db=db,
            citizen_id=payload.citizen_id,
            scheme_id=payload.scheme_id,
            applicant_data=payload.applicant_data,
            scheme_repository=repo,
        )
    except ApplicationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _build_application_response(app, db, repo)


@applications_router.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_single_application(
    application_id: uuid.UUID,
    citizen_id: Optional[uuid.UUID] = Query(None),
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """
    Get single application. Citizens can only get their own (compare citizen_id from token vs application.citizen_id — return 403 if mismatch).
    """
    app = db.query(Application).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    is_officer = False
    req_citizen_id = citizen_id

    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            if sub:
                try:
                    req_citizen_id = uuid.UUID(str(sub))
                except ValueError:
                    pass
        elif user_type == "officer" or auth_user.get("role"):
            is_officer = True

    if not is_officer:
        if not req_citizen_id:
            raise HTTPException(status_code=401, detail="Authentication required to view application.")
        if app.citizen_id != req_citizen_id:
            raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view this application.")

    return _build_application_response(app, db)


@applications_router.get("/applications/drafts/{application_id}", response_model=ApplicationResponse)
def get_application_draft(
    application_id: uuid.UUID,
    citizen_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """Retrieve application draft details with IDOR ownership check."""
    try:
        app = ApplicationService.get_application(
            db=db,
            application_id=application_id,
            citizen_id=citizen_id,
        )
    except ApplicationNotFoundError:
        raise HTTPException(status_code=404, detail="Application not found.")
    except ApplicationAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return _build_application_response(app, db)


@applications_router.patch("/applications/drafts/{application_id}", response_model=ApplicationResponse)
def update_application_draft(
    application_id: uuid.UUID,
    payload: ApplicationDraftUpdateRequest,
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """Update applicant data fields in a draft application."""
    try:
        app = ApplicationService.update_draft(
            db=db,
            application_id=application_id,
            citizen_id=payload.citizen_id,
            applicant_data=payload.applicant_data,
        )
    except ApplicationNotFoundError:
        raise HTTPException(status_code=404, detail="Application not found.")
    except ApplicationAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ApplicationStateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _build_application_response(app, db)


@applications_router.post("/applications/{application_id}/token", response_model=TokenResponse)
def request_confirmation_token(
    application_id: uuid.UUID,
    payload: TokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Generate a cryptographically secure 5-minute single-use confirmation token
    for official application submission.
    """
    app = ApplicationService.get_application(db=db, application_id=application_id, citizen_id=payload.citizen_id)
    if app.current_status not in ("draft", "ready_for_review"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot issue confirmation token for application in status '{app.current_status}'."
        )

    # Transition to ready_for_review if still draft
    if app.current_status == "draft":
        ApplicationService.transition_status(
            db=db,
            application_id=application_id,
            to_status="ready_for_review",
            changed_by="citizen",
            changed_by_user_id=payload.citizen_id,
            remarks="Review completed; token requested",
        )

    raw_token, record = TokenService.generate_token(
        db=db,
        citizen_id=payload.citizen_id,
        application_id=application_id,
    )

    return TokenResponse(
        application_id=application_id,
        raw_token=raw_token,
        expires_at=record.expires_at,
        expiry_minutes=5,
        instructions=(
            "Use this single-use token within 5 minutes to confirm and route your application. "
            "Never share this token with unauthorized persons."
        ),
    )


@applications_router.post("/applications/{application_id}/submit", response_model=ApplicationResponse)
def submit_application(
    application_id: uuid.UUID,
    payload: ApplicationSubmitRequest,
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """
    Execute consequential official submission using a valid single-use confirmation token.
    Generates a simulated submission reference with 'SIM-' prefix.
    """
    app_record = db.query(Application).filter_by(id=application_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found.")

    eff_citizen_id = payload.citizen_id
    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            if sub:
                token_citizen_id = uuid.UUID(str(sub))
                if eff_citizen_id and eff_citizen_id != token_citizen_id:
                    raise HTTPException(status_code=403, detail="Citizen ID mismatch with token.")
                eff_citizen_id = token_citizen_id

    if not eff_citizen_id:
        eff_citizen_id = app_record.citizen_id

    if app_record.citizen_id != eff_citizen_id:
        raise HTTPException(status_code=403, detail="Access denied: You do not own this application.")

    # Determine target status
    if payload.target_status:
        to_status = payload.target_status
    elif app_record.current_status == "ready_for_review":
        to_status = "submitted_to_official_portal"
    else:
        to_status = "SUBMITTED"

    try:
        app = ApplicationService.transition_status(
            db=db,
            application_id=application_id,
            to_status=to_status,
            changed_by="citizen",
            changed_by_user_id=eff_citizen_id,
            confirmation_token=payload.confirmation_token,
            remarks="Citizen confirmed submission with single-use token",
        )
    except ApplicationNotFoundError:
        raise HTTPException(status_code=404, detail="Application not found.")
    except ApplicationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _build_application_response(app, db)


@applications_router.post("/applications/{application_id}/officer-decision", response_model=ApplicationResponse)
def officer_decision_endpoint(
    application_id: uuid.UUID,
    payload: OfficerDecisionNewRequest,
    officer: dict = Depends(get_current_officer),
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """
    Officer review decision: requires officer JWT.
    Body: {decision: "APPROVED"|"REJECTED"|"NEEDS_CORRECTION", notes: str, order_number: str|null}
    Updates status. Creates audit log entry.
    Calls notification stub.
    """
    app = db.query(Application).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    officer_sub = officer.get("sub") or officer.get("officer_id")
    try:
        officer_id = uuid.UUID(str(officer_sub)) if officer_sub else uuid.uuid4()
    except ValueError:
        officer_id = uuid.uuid4()

    dec_upper = payload.decision.upper()
    if dec_upper in ("APPROVE", "APPROVED"):
        to_status = "APPROVED"
    elif dec_upper in ("REJECT", "REJECTED"):
        to_status = "REJECTED"
    else:
        to_status = "NEEDS_CORRECTION"

    try:
        updated_app = ApplicationService.transition_status(
            db=db,
            application_id=application_id,
            to_status=to_status,
            changed_by="officer",
            changed_by_user_id=officer_id,
            remarks=payload.notes,
            official_order_number=payload.order_number,
            rejection_reason=payload.notes if to_status in ("REJECTED", "NEEDS_CORRECTION") else None,
        )
    except ApplicationStateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch citizen language if available
    citizen = db.query(Citizen).filter_by(id=updated_app.citizen_id).first()
    lang = citizen.preferred_language if citizen else "en"

    # Call notification stub
    notify_status_change(
        citizen_id=str(updated_app.citizen_id),
        application_id=str(updated_app.id),
        new_status=dec_upper,
        language=lang,
    )

    return _build_application_response(updated_app, db)


@applications_router.get("/applications/{application_id}/timeline", response_model=List[TimelineItemResponse])
def get_application_timeline(
    application_id: uuid.UUID,
    citizen_id: Optional[uuid.UUID] = Query(None),
    auth_user: Optional[dict] = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> List[TimelineItemResponse]:
    """
    Returns list of {timestamp, status, actor, notes} from AuditLog for this application.
    """
    app = db.query(Application).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    is_officer = False
    req_citizen_id = citizen_id

    if auth_user:
        user_type = auth_user.get("type", "citizen")
        if user_type == "citizen":
            sub = auth_user.get("sub") or auth_user.get("citizen_id")
            if sub:
                try:
                    req_citizen_id = uuid.UUID(str(sub))
                except ValueError:
                    pass
        elif user_type == "officer" or auth_user.get("role"):
            is_officer = True

    if not is_officer and req_citizen_id and app.citizen_id != req_citizen_id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this application.")

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.target_entity == "application", AuditLog.target_id == application_id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    items = []
    for log in logs:
        st = log.details.get("to_status") or log.details.get("status") or log.action
        notes = log.details.get("remarks") or log.details.get("notes") or log.action
        items.append(
            TimelineItemResponse(
                timestamp=log.created_at,
                status=st,
                actor=log.actor_type or "system",
                notes=notes,
            )
        )

    # Fallback to status history if no audit logs
    if not items:
        for h in app.status_history:
            items.append(
                TimelineItemResponse(
                    timestamp=h.created_at,
                    status=h.to_status,
                    actor=h.changed_by,
                    notes=h.remarks,
                )
            )

    return items


@applications_router.get("/applications/{application_id}/history", response_model=List[ApplicationStatusHistoryResponse])
def get_application_history(
    application_id: uuid.UUID,
    citizen_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
) -> List[ApplicationStatusHistoryResponse]:
    """Retrieve immutable status transition audit trail for an application."""
    app = ApplicationService.get_application(db=db, application_id=application_id, citizen_id=citizen_id)
    return [
        ApplicationStatusHistoryResponse(
            id=h.id,
            from_status=h.from_status,
            to_status=h.to_status,
            remarks=h.remarks,
            changed_by=h.changed_by,
            created_at=h.created_at,
        )
        for h in app.status_history
    ]


@applications_router.post("/applications/{application_id}/decision", response_model=ApplicationResponse)
def officer_decision(
    application_id: uuid.UUID,
    payload: OfficerDecisionRequest,
    db: Session = Depends(get_db),
) -> ApplicationResponse:
    """
    Officer review decision: approves, rejects, or requests action on an application.
    Enforces role-based authority.
    """
    app = ApplicationService.get_application(db=db, application_id=application_id)

    # First move to under_review if currently submitted_to_official_portal
    if app.current_status == "submitted_to_official_portal":
        ApplicationService.transition_status(
            db=db,
            application_id=application_id,
            to_status="under_review",
            changed_by="officer",
            changed_by_user_id=payload.officer_id,
            remarks="Application taken up for review by officer",
        )

    try:
        updated_app = ApplicationService.transition_status(
            db=db,
            application_id=application_id,
            to_status=payload.decision,
            changed_by="officer",
            changed_by_user_id=payload.officer_id,
            remarks=payload.remarks,
            official_order_number=payload.official_order_number,
            rejection_reason=payload.rejection_reason,
        )
    except ApplicationStateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch citizen language
    citizen = db.query(Citizen).filter_by(id=updated_app.citizen_id).first()
    lang = citizen.preferred_language if citizen else "en"

    notify_status_change(
        citizen_id=str(updated_app.citizen_id),
        application_id=str(updated_app.id),
        new_status=payload.decision,
        language=lang,
    )

    return ApplicationResponse(
        id=updated_app.id,
        citizen_id=updated_app.citizen_id,
        scheme_id=updated_app.scheme_id,
        current_status=updated_app.current_status,
        submission_mode=updated_app.submission_mode,
        progress_percentage=updated_app.progress_percentage,
        applicant_data=updated_app.applicant_data,
        submission_reference=updated_app.submission_reference,
        submitted_at=updated_app.submitted_at,
        rejection_reason=updated_app.rejection_reason,
        official_order_number=updated_app.official_order_number,
        is_simulated=updated_app.is_simulated,
        created_at=updated_app.created_at,
        updated_at=updated_app.updated_at,
    )


@applications_router.get("/citizens/{citizen_id}/applications", response_model=List[ApplicationResponse])
def list_citizen_applications(
    citizen_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> List[ApplicationResponse]:
    """List all application drafts and submissions for a citizen."""
    apps = ApplicationService.list_citizen_applications(db=db, citizen_id=citizen_id)
    return [
        ApplicationResponse(
            id=a.id,
            citizen_id=a.citizen_id,
            scheme_id=a.scheme_id,
            current_status=a.current_status,
            submission_mode=a.submission_mode,
            progress_percentage=a.progress_percentage,
            applicant_data=a.applicant_data,
            submission_reference=a.submission_reference,
            submitted_at=a.submitted_at,
            rejection_reason=a.rejection_reason,
            official_order_number=a.official_order_number,
            is_simulated=a.is_simulated,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in apps
    ]
