"""
Audit logging service for Gram Saathi.
Maintains an immutable record of system and user operations.
Never stores raw PII, plaintext tokens, passwords, or sensitive credentials.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from backend.db.models import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        actor_type: str,
        actor_id: Optional[uuid.UUID] = None,
        target_entity: str = "general",
        target_id: Optional[uuid.UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Record a structured audit log entry.
        """
        clean_details = dict(details) if details else {}

        # Sanitize details: strip any accidental tokens or passwords
        for key in list(clean_details.keys()):
            if any(s in key.lower() for s in ("password", "secret", "token", "aadhaar")):
                clean_details[key] = "[REDACTED]"

        entry = AuditLog(
            action=action,
            actor_type=actor_type,
            actor_id=actor_id,
            target_entity=target_entity,
            target_id=target_id,
            details=clean_details,
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc),
        )
        try:
            db.add(entry)
            db.commit()
            db.refresh(entry)
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record audit log: {e}")
        return entry

    @classmethod
    def log_citizen_submission(
        cls,
        db: Session,
        citizen_id: uuid.UUID,
        application_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """Log citizen submission action."""
        return cls.log(
            db=db,
            action="SUBMITTED",
            actor_type="citizen",
            actor_id=citizen_id,
            target_entity="application",
            target_id=application_id,
            details={
                "status": "SUBMITTED",
                "to_status": "SUBMITTED",
                "remarks": "Citizen confirmed submission with single-use token",
            },
            ip_address=ip_address,
        )

    @classmethod
    def log_officer_decision(
        cls,
        db: Session,
        officer_id: uuid.UUID,
        application_id: uuid.UUID,
        decision: str,
        notes: Optional[str] = None,
        order_number: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """Log officer decision action."""
        dec = decision.upper()
        return cls.log(
            db=db,
            action=f"OFFICER_{dec}",
            actor_type="officer",
            actor_id=officer_id,
            target_entity="application",
            target_id=application_id,
            details={
                "decision": dec,
                "status": dec,
                "to_status": dec,
                "notes": notes or "",
                "remarks": notes or "",
                "order_number": order_number,
            },
            ip_address=ip_address,
        )

