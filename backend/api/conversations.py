"""
Conversation session and message history endpoints for Gram Saathi.
Supports multi-day session persistence, message history, and ownership validation.
"""
from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.services.conversation_service import (
    ConversationService,
    ConversationAccessDeniedError,
    ConversationNotFoundError,
)
from backend.api.schemas import (
    ConversationCreateRequest,
    ConversationSessionResponse,
    MessageSendRequest,
    MessageResponse,
)

conversations_router = APIRouter(prefix="/conversations", tags=["conversations"])


def _check_sensitive_content(text: str) -> None:
    """Reject Aadhaar or credentials in chat messages before saving."""
    lower = text.lower()
    if any(k in lower for k in ("otp", "password", "bank account", "ifsc")):
        raise HTTPException(
            status_code=422,
            detail="Please remove passwords, OTPs, or bank account numbers before sending.",
        )
    # Check for 12 digit contiguous numbers (potential raw Aadhaar)
    digits_only = "".join(c for c in text if c.isdigit())
    if len(digits_only) == 12:
        raise HTTPException(
            status_code=422,
            detail="Do not send raw 12-digit Aadhaar numbers in chat.",
        )


@conversations_router.post("", response_model=ConversationSessionResponse, status_code=status.HTTP_200_OK)
def get_or_create_conversation(
    payload: ConversationCreateRequest,
    db: Session = Depends(get_db),
) -> ConversationSessionResponse:
    """Create or recover a persistent multi-day conversation session."""
    session, _ = ConversationService.get_or_create_session(
        db=db,
        session_token=payload.session_token,
        citizen_id=payload.citizen_id,
        phone_number=payload.phone_number,
        language=payload.language,
        channel=payload.channel,
    )
    return ConversationSessionResponse(
        id=session.id,
        session_token=session.session_token,
        citizen_id=session.citizen_id,
        phone_number=session.phone_number,
        channel=session.channel,
        language=session.language,
        current_stage=session.current_stage,
        active_scheme_id=session.active_scheme_id,
        active_application_id=session.active_application_id,
        last_message_at=session.last_message_at,
        created_at=session.created_at,
    )


@conversations_router.get("/{session_id}", response_model=ConversationSessionResponse)
def get_conversation_session(
    session_id: uuid.UUID,
    session_token: Optional[str] = Query(None),
    citizen_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
) -> ConversationSessionResponse:
    """Retrieve session details with ownership verification."""
    try:
        session = ConversationService.get_session(
            db=db,
            session_id=session_id,
            citizen_id=citizen_id,
            session_token=session_token,
        )
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="Conversation session not found.")
    except ConversationAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return ConversationSessionResponse(
        id=session.id,
        session_token=session.session_token,
        citizen_id=session.citizen_id,
        phone_number=session.phone_number,
        channel=session.channel,
        language=session.language,
        current_stage=session.current_stage,
        active_scheme_id=session.active_scheme_id,
        active_application_id=session.active_application_id,
        last_message_at=session.last_message_at,
        created_at=session.created_at,
    )


@conversations_router.post("/{session_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_conversation_message(
    session_id: uuid.UUID,
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Append a message to the persistent conversation session."""
    _check_sensitive_content(payload.content)

    # Verify session access
    try:
        ConversationService.get_session(
            db=db,
            session_id=session_id,
            citizen_id=payload.citizen_id,
            session_token=payload.session_token,
        )
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="Conversation session not found.")
    except ConversationAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    msg = ConversationService.add_message(
        db=db,
        session_id=session_id,
        sender=payload.sender,
        content=payload.content,
        content_type=payload.content_type,
        metadata=payload.metadata,
    )

    return MessageResponse(
        id=msg.id,
        session_id=msg.session_id,
        sender=msg.sender,
        content=msg.content,
        content_type=msg.content_type,
        metadata=msg.message_metadata,
        created_at=msg.created_at,
    )


@conversations_router.get("/{session_id}/history", response_model=List[MessageResponse])
def get_conversation_history(
    session_id: uuid.UUID,
    session_token: Optional[str] = Query(None),
    citizen_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[MessageResponse]:
    """Retrieve full chronological message history for a persistent session."""
    try:
        messages = ConversationService.get_session_history(
            db=db,
            session_id=session_id,
            citizen_id=citizen_id,
            session_token=session_token,
            limit=limit,
        )
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="Conversation session not found.")
    except ConversationAccessDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return [
        MessageResponse(
            id=m.id,
            session_id=m.session_id,
            sender=m.sender,
            content=m.content,
            content_type=m.content_type,
            metadata=m.message_metadata,
            created_at=m.created_at,
        )
        for m in messages
    ]
