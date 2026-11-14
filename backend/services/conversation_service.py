"""
Persistent multi-day conversation management service for Gram Saathi.
Supports session resumption after days/restarts, language preference tracking,
secure message persistence, and citizen ownership verification.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session

from backend.db.models import ConversationSession, ConversationMessage, Citizen
from backend.services.audit_service import AuditService


class ConversationAccessDeniedError(Exception):
    """Raised when a user attempts to access a conversation session they do not own."""
    pass


class ConversationNotFoundError(Exception):
    """Raised when a requested session is not found."""
    pass


class ConversationService:
    @staticmethod
    def get_or_create_session(
        db: Session,
        session_token: Optional[str] = None,
        citizen_id: Optional[uuid.UUID] = None,
        phone_number: Optional[str] = None,
        language: str = "en",
        channel: str = "web",
    ) -> Tuple[ConversationSession, bool]:
        """
        Retrieve an existing conversation session or initialize a new persistent session.
        Returns (session, created_boolean).
        """
        now = datetime.now(timezone.utc)
        session: Optional[ConversationSession] = None

        # 1. Lookup by session token if provided
        if session_token:
            session = db.query(ConversationSession).filter_by(session_token=session_token).first()

        # 2. Lookup by citizen_id or phone_number if no active token match
        if not session and citizen_id:
            session = (
                db.query(ConversationSession)
                .filter_by(citizen_id=citizen_id)
                .order_by(ConversationSession.last_message_at.desc())
                .first()
            )
        elif not session and phone_number:
            session = (
                db.query(ConversationSession)
                .filter_by(phone_number=phone_number)
                .order_by(ConversationSession.last_message_at.desc())
                .first()
            )

        if session:
            # Update last activity and language preference
            session.last_message_at = now
            if language and language in ("en", "kn", "hi"):
                session.language = language
            db.commit()
            db.refresh(session)
            return session, False

        # 3. Create new persistent session
        new_token = session_token or secrets.token_hex(24)
        new_session = ConversationSession(
            session_token=new_token,
            citizen_id=citizen_id,
            phone_number=phone_number,
            channel=channel,
            language=language if language in ("en", "kn", "hi") else "en",
            current_stage="GREETING",
            context_data={},
            last_message_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        AuditService.log(
            db=db,
            action="CONVERSATION_SESSION_CREATED",
            actor_type="citizen" if citizen_id else "anonymous",
            actor_id=citizen_id,
            target_entity="conversation",
            target_id=new_session.id,
            details={"channel": channel, "language": language},
        )
        return new_session, True

    @staticmethod
    def add_message(
        db: Session,
        session_id: uuid.UUID,
        sender: str,
        content: str,
        content_type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ConversationMessage:
        """
        Append a message to the persistent conversation.
        Updates session.last_message_at.
        """
        session = db.query(ConversationSession).filter_by(id=session_id).first()
        if not session:
            raise ConversationNotFoundError(f"Session {session_id} not found.")

        now = datetime.now(timezone.utc)
        msg = ConversationMessage(
            session_id=session_id,
            sender=sender,
            content=content,
            content_type=content_type,
            message_metadata=metadata or {},
            created_at=now,
        )
        db.add(msg)
        session.last_message_at = now
        session.updated_at = now
        db.commit()
        db.refresh(msg)
        return msg

    @staticmethod
    def get_session(
        db: Session,
        session_id: uuid.UUID,
        citizen_id: Optional[uuid.UUID] = None,
        session_token: Optional[str] = None,
    ) -> ConversationSession:
        """
        Retrieve session with IDOR ownership validation.
        """
        session = db.query(ConversationSession).filter_by(id=session_id).first()
        if not session:
            raise ConversationNotFoundError(f"Session {session_id} not found.")

        # Citizen IDOR check
        if citizen_id is not None:
            if session.citizen_id is not None and session.citizen_id != citizen_id:
                raise ConversationAccessDeniedError("Access denied: You do not own this conversation session.")

        # Token ownership check for anonymous sessions
        if session_token is not None and session.session_token != session_token:
            raise ConversationAccessDeniedError("Access denied: Invalid session token.")

        return session

    @staticmethod
    def get_session_history(
        db: Session,
        session_id: uuid.UUID,
        citizen_id: Optional[uuid.UUID] = None,
        session_token: Optional[str] = None,
        limit: int = 50,
    ) -> List[ConversationMessage]:
        """
        Retrieve messages for a session in chronological order after permission check.
        """
        ConversationService.get_session(
            db=db,
            session_id=session_id,
            citizen_id=citizen_id,
            session_token=session_token,
        )
        return (
            db.query(ConversationMessage)
            .filter_by(session_id=session_id)
            .order_by(ConversationMessage.created_at.asc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def list_citizen_sessions(
        db: Session,
        citizen_id: uuid.UUID,
    ) -> List[ConversationSession]:
        """List all conversation sessions for an authenticated citizen."""
        return (
            db.query(ConversationSession)
            .filter_by(citizen_id=citizen_id)
            .order_by(ConversationSession.last_message_at.desc())
            .all()
        )

    @staticmethod
    def update_stage(
        db: Session,
        session_id: uuid.UUID,
        new_stage: str,
        active_scheme_id: Optional[str] = None,
        active_application_id: Optional[uuid.UUID] = None,
        context_data_update: Optional[Dict[str, Any]] = None,
    ) -> ConversationSession:
        """
        Update conversation state machine stage and context memory.
        """
        session = db.query(ConversationSession).filter_by(id=session_id).first()
        if not session:
            raise ConversationNotFoundError(f"Session {session_id} not found.")

        session.current_stage = new_stage
        if active_scheme_id is not None:
            session.active_scheme_id = active_scheme_id
        if active_application_id is not None:
            session.active_application_id = active_application_id
        if context_data_update:
            merged = dict(session.context_data)
            merged.update(context_data_update)
            session.context_data = merged

        now = datetime.now(timezone.utc)
        session.updated_at = now
        db.commit()
        db.refresh(session)
        return session
