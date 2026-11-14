"""
Application draft and lifecycle service for Gram Saathi.
Manages status state machine, audit history, confirmation token enforcement,
and simulated official submission references.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from sqlalchemy.orm import Session

from backend.db.models import Application, ApplicationStatusHistory, Citizen, UploadedDocument
from backend.schemes.repository import SchemeRepository
from backend.services.token_service import TokenService
from backend.services.audit_service import AuditService

# Valid status transitions
VALID_TRANSITIONS: Dict[str, List[str]] = {
    # Original lower-case transitions
    "draft": ["ready_for_review", "doc_collection", "DOC_COLLECTION", "submitted_to_official_portal", "SUBMITTED", "submitted"],
    "ready_for_review": ["submitted_to_official_portal", "draft", "SUBMITTED", "submitted"],
    "submitted_to_official_portal": ["under_review", "under_verification", "officer_review", "OFFICER_REVIEW", "UNDER_VERIFICATION", "approved", "rejected", "action_required", "APPROVED", "REJECTED", "NEEDS_CORRECTION"],
    "under_review": ["approved", "rejected", "action_required", "APPROVED", "REJECTED", "NEEDS_CORRECTION", "needs_correction"],
    "action_required": ["ready_for_review", "under_review", "DOC_COLLECTION", "SUBMITTED", "officer_review"],
    "approved": [],
    "rejected": [],

    # Lifecycle state machine: DRAFT -> DOC_COLLECTION -> SUBMITTED -> UNDER_VERIFICATION -> OFFICER_REVIEW -> APPROVED / REJECTED / NEEDS_CORRECTION
    "DRAFT": ["DOC_COLLECTION", "SUBMITTED", "submitted_to_official_portal", "ready_for_review", "draft"],
    "DOC_COLLECTION": ["SUBMITTED", "submitted_to_official_portal", "UNDER_VERIFICATION", "DRAFT", "draft"],
    "SUBMITTED": ["UNDER_VERIFICATION", "OFFICER_REVIEW", "under_review", "APPROVED", "REJECTED", "NEEDS_CORRECTION", "approved", "rejected", "action_required"],
    "UNDER_VERIFICATION": ["OFFICER_REVIEW", "NEEDS_CORRECTION", "REJECTED", "APPROVED", "under_review"],
    "OFFICER_REVIEW": ["APPROVED", "REJECTED", "NEEDS_CORRECTION", "approved", "rejected", "action_required"],
    "NEEDS_CORRECTION": ["DOC_COLLECTION", "SUBMITTED", "OFFICER_REVIEW", "ready_for_review"],
    "APPROVED": [],
    "REJECTED": [],
}


class ApplicationError(Exception):
    """Base application exception."""
    pass


class ApplicationNotFoundError(ApplicationError):
    """Application record not found."""
    pass


class ApplicationStateTransitionError(ApplicationError):
    """Illegal state machine transition attempt."""
    pass


class ApplicationAccessDeniedError(ApplicationError):
    """Citizen does not own application or officer lacks jurisdiction."""
    pass


class ApplicationService:
    @staticmethod
    def create_draft(
        db: Session,
        citizen_id: uuid.UUID,
        scheme_id: str,
        applicant_data: Optional[Dict[str, Any]] = None,
        scheme_repository: Optional[SchemeRepository] = None,
    ) -> Application:
        """
        Create a new application draft for a scheme.
        Validates that scheme exists in scheme repository.
        """
        # Validate citizen exists
        citizen = db.query(Citizen).filter_by(id=citizen_id).first()
        if not citizen:
            raise ApplicationError(f"Citizen {citizen_id} not found.")

        # Validate scheme exists in repository if repository provided
        if scheme_repository is not None:
            scheme = getattr(scheme_repository, "get_scheme", getattr(scheme_repository, "get_by_id", None))(scheme_id)
            if not scheme:
                raise ApplicationError(f"Scheme '{scheme_id}' does not exist in repository.")

        now = datetime.now(timezone.utc)
        initial_data = applicant_data or {}

        # Calculate initial progress
        progress = 10 if initial_data else 5

        app = Application(
            citizen_id=citizen_id,
            scheme_id=scheme_id,
            current_status="draft",
            submission_mode="assisted_official",
            progress_percentage=progress,
            applicant_data=initial_data,
            is_simulated=True,
            jurisdiction_district=citizen.district,
            jurisdiction_village=citizen.village,
            created_at=now,
            updated_at=now,
        )
        db.add(app)
        db.flush()

        # Link any pre-uploaded documents to this application
        doc_ids = initial_data.get("document_ids") or []
        for did in doc_ids:
            try:
                duuid = uuid.UUID(str(did))
                doc = db.query(UploadedDocument).filter_by(id=duuid).first()
                if doc:
                    doc.application_id = app.id
            except (ValueError, TypeError):
                pass

        # Record initial status history
        history = ApplicationStatusHistory(
            application_id=app.id,
            from_status=None,
            to_status="draft",
            remarks="Draft created",
            changed_by="citizen",
            changed_by_user_id=citizen_id,
            created_at=now,
        )
        db.add(history)
        db.commit()
        db.refresh(app)

        AuditService.log(
            db=db,
            action="APPLICATION_DRAFT_CREATED",
            actor_type="citizen",
            actor_id=citizen_id,
            target_entity="application",
            target_id=app.id,
            details={"scheme_id": scheme_id},
        )
        return app

    @staticmethod
    def update_draft(
        db: Session,
        application_id: uuid.UUID,
        citizen_id: uuid.UUID,
        applicant_data: Dict[str, Any],
    ) -> Application:
        """
        Update fields in an application draft.
        Enforces citizen ownership and ensures status is 'draft' or 'action_required'.
        """
        app = db.query(Application).filter_by(id=application_id).first()
        if not app:
            raise ApplicationNotFoundError(f"Application {application_id} not found.")

        if app.citizen_id != citizen_id:
            raise ApplicationAccessDeniedError("Access denied: You do not own this application.")

        if app.current_status not in ("draft", "action_required"):
            raise ApplicationStateTransitionError(
                f"Cannot update application in status '{app.current_status}'."
            )

        merged_data = dict(app.applicant_data)
        merged_data.update(applicant_data)
        app.applicant_data = merged_data

        # Link document IDs if provided
        doc_ids = applicant_data.get("document_ids") or []
        for did in doc_ids:
            try:
                duuid = uuid.UUID(str(did))
                doc = db.query(UploadedDocument).filter_by(id=duuid).first()
                if doc:
                    doc.application_id = app.id
            except (ValueError, TypeError):
                pass

        # Update progress percentage
        field_count = len(merged_data)
        app.progress_percentage = min(90, 20 + field_count * 10)
        app.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def transition_status(
        db: Session,
        application_id: uuid.UUID,
        to_status: str,
        changed_by: str,
        changed_by_user_id: Optional[uuid.UUID] = None,
        remarks: Optional[str] = None,
        confirmation_token: Optional[str] = None,
        official_order_number: Optional[str] = None,
        rejection_reason: Optional[str] = None,
    ) -> Application:
        """
        Execute a validated state machine transition with audit history.
        Enforces confirmation token requirement when submitting.
        """
        app = db.query(Application).filter_by(id=application_id).first()
        if not app:
            raise ApplicationNotFoundError(f"Application {application_id} not found.")

        current = app.current_status
        allowed = VALID_TRANSITIONS.get(current, [])
        if not allowed:
            allowed = VALID_TRANSITIONS.get(current.lower(), []) or VALID_TRANSITIONS.get(current.upper(), [])

        is_allowed = to_status in allowed or any(to_status.lower() == a.lower() for a in allowed)
        if not is_allowed:
            raise ApplicationStateTransitionError(
                f"Illegal transition from '{current}' to '{to_status}'. Allowed transitions: {allowed}"
            )

        now = datetime.now(timezone.utc)
        is_submission = to_status.lower() in ("submitted_to_official_portal", "submitted")

        # Enforce single-use token on official submission
        if is_submission:
            if not confirmation_token:
                raise ApplicationError("Confirmation token is required for official submission.")

            is_valid, err_code, _ = TokenService.validate_and_consume(
                db=db,
                citizen_id=app.citizen_id,
                application_id=app.id,
                raw_token=confirmation_token,
            )
            if not is_valid:
                raise ApplicationError(f"Confirmation token validation failed: {err_code}")

            # Generate simulated submission reference with SIM- prefix
            random_suffix = secrets.token_hex(4).upper()
            app.submission_reference = f"SIM-GS-{now.year}-{random_suffix}"
            app.submitted_at = now
            app.progress_percentage = 100

        if to_status.lower() == "approved":
            app.official_order_number = official_order_number or f"ORD-{secrets.token_hex(4).upper()}"

        if to_status.lower() == "rejected":
            app.rejection_reason = rejection_reason or "Criteria requirements not fulfilled."

        if to_status.lower() in ("needs_correction", "action_required"):
            app.rejection_reason = rejection_reason or remarks or "Needs correction"

        if to_status.lower() == "ready_for_review":
            app.progress_percentage = 90

        # Update application status
        app.current_status = to_status
        app.updated_at = now

        # Record immutable history
        history = ApplicationStatusHistory(
            application_id=app.id,
            from_status=current,
            to_status=to_status,
            remarks=remarks or f"Transitioned from {current} to {to_status}",
            changed_by=changed_by,
            changed_by_user_id=changed_by_user_id,
            created_at=now,
        )
        db.add(history)
        db.commit()
        db.refresh(app)

        if is_submission:
            AuditService.log_citizen_submission(db=db, citizen_id=app.citizen_id, application_id=app.id)

        if changed_by == "officer" and to_status.lower() in ("approved", "rejected", "needs_correction", "action_required"):
            AuditService.log_officer_decision(
                db=db,
                officer_id=changed_by_user_id,
                application_id=app.id,
                decision=to_status,
                notes=remarks,
                order_number=official_order_number,
            )

        AuditService.log(
            db=db,
            action=f"APPLICATION_STATUS_{to_status.upper()}",
            actor_type=changed_by,
            actor_id=changed_by_user_id,
            target_entity="application",
            target_id=app.id,
            details={"from_status": current, "to_status": to_status},
        )
        return app

    @staticmethod
    def get_application(
        db: Session,
        application_id: uuid.UUID,
        citizen_id: Optional[uuid.UUID] = None,
        officer_id: Optional[uuid.UUID] = None,
    ) -> Application:
        """Retrieve application with IDOR ownership and permission checks."""
        app = db.query(Application).filter_by(id=application_id).first()
        if not app:
            raise ApplicationNotFoundError(f"Application {application_id} not found.")

        # Citizen IDOR check
        if citizen_id is not None and app.citizen_id != citizen_id:
            raise ApplicationAccessDeniedError("Access denied: You do not have permission to view this application.")

        return app

    @staticmethod
    def list_citizen_applications(
        db: Session,
        citizen_id: uuid.UUID,
    ) -> List[Application]:
        """List all applications owned by a citizen."""
        return db.query(Application).filter_by(citizen_id=citizen_id).order_by(Application.created_at.desc()).all()
