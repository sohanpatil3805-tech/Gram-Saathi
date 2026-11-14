"""
Cryptographically secure confirmation token management for Gram Saathi.
Implements 5-minute single-use tokens stored as SHA-256 hashes to prevent
replay attacks and unauthorized official service submissions.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional

from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import ConfirmationToken, Application


def hash_token(raw_token: str) -> str:
    """Return SHA-256 hex digest of a raw confirmation token."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


class TokenService:
    @staticmethod
    def generate_token(
        db: Session,
        citizen_id: uuid.UUID,
        application_id: uuid.UUID,
        expiry_minutes: Optional[int] = None,
    ) -> Tuple[str, ConfirmationToken]:
        """
        Generate a cryptographically secure, single-use confirmation token.
        Stores only the SHA-256 hash in the database.
        Returns the raw token string (to be sent to citizen) and the DB record.
        """
        minutes = expiry_minutes if expiry_minutes is not None else settings.confirmation_token_expire_minutes
        raw_token = f"gs_confirm_{secrets.token_urlsafe(32)}"
        token_hash = hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=minutes)

        token_record = ConfirmationToken(
            citizen_id=citizen_id,
            application_id=application_id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_consumed=False,
            created_at=now,
        )
        db.add(token_record)
        db.commit()
        db.refresh(token_record)
        return raw_token, token_record

    @staticmethod
    def validate_and_consume(
        db: Session,
        citizen_id: uuid.UUID,
        application_id: uuid.UUID,
        raw_token: str,
    ) -> Tuple[bool, Optional[str], Optional[ConfirmationToken]]:
        """
        Validate and consume a single-use confirmation token.
        Rejects if:
        1. Token does not exist
        2. Token belongs to different citizen or application
        3. Token is already consumed (replay attack prevention)
        4. Token has expired (5-minute TTL)

        Returns (is_valid, error_code, token_record)
        """
        if not raw_token or not raw_token.strip():
            return False, "TOKEN_EMPTY", None

        token_hash = hash_token(raw_token)
        token_record = db.query(ConfirmationToken).filter_by(token_hash=token_hash).first()

        if not token_record:
            return False, "TOKEN_NOT_FOUND", None

        # Ownership & application verification
        if token_record.citizen_id != citizen_id or token_record.application_id != application_id:
            return False, "TOKEN_MISMATCH", None

        # Replay attack prevention: single-use check
        if token_record.is_consumed:
            return False, "TOKEN_ALREADY_CONSUMED", token_record

        # Expiry check
        now = datetime.now(timezone.utc)
        # Handle both timezone-aware and naive datetimes safely
        expires_at = token_record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if now > expires_at:
            return False, "TOKEN_EXPIRED", token_record

        # Mark consumed atomically
        token_record.is_consumed = True
        token_record.consumed_at = now
        db.commit()
        db.refresh(token_record)

        return True, None, token_record

    @classmethod
    def create_confirmation_token(
        cls,
        application_id: str | uuid.UUID,
        citizen_id: Optional[str | uuid.UUID] = None,
        db: Optional[Session] = None,
    ) -> str:
        """
        Create a 5-minute single-use token for an application.
        Accepts application_id as string or UUID. If db not provided, uses SessionLocal().
        """
        from backend.db.session import SessionLocal
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            app_uuid = uuid.UUID(str(application_id)) if not isinstance(application_id, uuid.UUID) else application_id
            cit_uuid = None
            if citizen_id is not None:
                cit_uuid = uuid.UUID(str(citizen_id)) if not isinstance(citizen_id, uuid.UUID) else citizen_id
            else:
                app = db.query(Application).filter_by(id=app_uuid).first()
                if app:
                    cit_uuid = app.citizen_id
                else:
                    raise ValueError(f"Application {application_id} not found")

            raw_token, _ = cls.generate_token(
                db=db,
                citizen_id=cit_uuid,
                application_id=app_uuid,
                expiry_minutes=5,
            )
            return raw_token
        finally:
            if should_close:
                db.close()

    @classmethod
    def validate_and_consume_token(
        cls,
        token: str,
        application_id: str | uuid.UUID,
        db: Optional[Session] = None,
    ) -> bool:
        """
        Validates and consumes a single-use token for an application.
        Returns True if valid, False otherwise.
        """
        from backend.db.session import SessionLocal
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            if not token or not token.strip():
                return False
            app_uuid = uuid.UUID(str(application_id)) if not isinstance(application_id, uuid.UUID) else application_id
            token_hash = hash_token(token)
            token_record = db.query(ConfirmationToken).filter_by(token_hash=token_hash).first()
            if not token_record:
                return False
            if token_record.application_id != app_uuid:
                return False
            if token_record.is_consumed:
                return False

            now = datetime.now(timezone.utc)
            expires_at = token_record.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                return False

            token_record.is_consumed = True
            token_record.consumed_at = now
            db.commit()
            return True
        except Exception:
            return False
        finally:
            if should_close:
                db.close()


# Module-level aliases
create_confirmation_token = TokenService.create_confirmation_token
validate_and_consume_token = TokenService.validate_and_consume_token
