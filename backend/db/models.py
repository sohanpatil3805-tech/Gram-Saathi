"""
SQLAlchemy 2.x database models for Gram Saathi.
Implements the 11 core production models with UUID primary keys,
proper foreign keys, indexes, and privacy protections.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy import (
    String,
    Text,
    Integer,
    Numeric,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Uuid,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from backend.db.base import Base


def utcnow() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


# ─── 1. Citizen ──────────────────────────────────────────────────────────────
class Citizen(Base):
    """
    Primary citizen identity model.
    Phone number is the primary unique identifier for multi-day WhatsApp & web access.
    Aadhaar is NEVER stored in plaintext; only masked (XXXX-XXXX-1234) or SHA-256 hash.
    """
    __tablename__ = "citizens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number: Mapped[str] = mapped_column(String(15), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    citizen_group: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(50), default="Karnataka", nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    village: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    aadhaar_ref: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    profile: Mapped[Optional["CitizenProfile"]] = relationship("CitizenProfile", uselist=False, back_populates="citizen", cascade="all, delete-orphan")
    sessions: Mapped[List["ConversationSession"]] = relationship("ConversationSession", back_populates="citizen")
    applications: Mapped[List["Application"]] = relationship("Application", back_populates="citizen")
    documents: Mapped[List["UploadedDocument"]] = relationship("UploadedDocument", back_populates="citizen")
    tokens: Mapped[List["ConfirmationToken"]] = relationship("ConfirmationToken", back_populates="citizen")


# ─── 2. Citizen Profile ──────────────────────────────────────────────────────
class CitizenProfile(Base):
    """
    Socio-economic profile used for deterministic eligibility evaluation.
    Bank account numbers and IFSC codes are NEVER stored here or anywhere else.
    """
    __tablename__ = "citizen_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("citizens.id", ondelete="CASCADE"), unique=True, nullable=False)
    annual_income: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    land_holding_acres: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    caste_category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_bpl: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    education_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_differently_abled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_bank_account: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationship
    citizen: Mapped["Citizen"] = relationship("Citizen", back_populates="profile")


# ─── 3. Conversation Session ─────────────────────────────────────────────────
class ConversationSession(Base):
    """
    Persistent multi-day conversation session. Survives restarts and long idle gaps.
    """
    __tablename__ = "conversation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("citizens.id", ondelete="SET NULL"), nullable=True, index=True)
    session_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(String(20), default="web", nullable=False)  # 'web', 'whatsapp'
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)  # 'en', 'kn', 'hi'
    current_stage: Mapped[str] = mapped_column(String(50), default="GREETING", nullable=False)
    active_scheme_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    active_application_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
    context_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    citizen: Mapped[Optional["Citizen"]] = relationship("Citizen", back_populates="sessions")
    messages: Mapped[List["ConversationMessage"]] = relationship("ConversationMessage", back_populates="session", order_by="ConversationMessage.created_at", cascade="all, delete-orphan")


# ─── 4. Conversation Message ─────────────────────────────────────────────────
class ConversationMessage(Base):
    """
    Individual message inside a persistent conversation.
    """
    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender: Mapped[str] = mapped_column(String(20), nullable=False)  # 'citizen', 'assistant', 'system'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), default="text", nullable=False)  # 'text', 'image', 'document', 'token_request'
    message_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationship
    session: Mapped["ConversationSession"] = relationship("ConversationSession", back_populates="messages")


# ─── 5. Application ──────────────────────────────────────────────────────────
class Application(Base):
    """
    Formal government service application draft and lifecycle record.
    Status transitions:
    draft -> ready_for_review -> submitted_to_official_portal -> under_review -> approved / rejected / action_required
    """
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("citizens.id", ondelete="CASCADE"), nullable=False, index=True)
    scheme_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    current_status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)
    submission_mode: Mapped[str] = mapped_column(String(30), default="assisted_official", nullable=False)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    applicant_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    submission_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    official_order_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_officer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("officers.id", ondelete="SET NULL"), nullable=True)
    jurisdiction_district: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    jurisdiction_village: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    citizen: Mapped["Citizen"] = relationship("Citizen", back_populates="applications")
    officer: Mapped[Optional["Officer"]] = relationship("Officer", back_populates="assigned_applications")
    status_history: Mapped[List["ApplicationStatusHistory"]] = relationship("ApplicationStatusHistory", back_populates="application", order_by="ApplicationStatusHistory.created_at", cascade="all, delete-orphan")
    documents: Mapped[List["UploadedDocument"]] = relationship("UploadedDocument", back_populates="application")
    tokens: Mapped[List["ConfirmationToken"]] = relationship("ConfirmationToken", back_populates="application")


# ─── 6. Application Status History ───────────────────────────────────────────
class ApplicationStatusHistory(Base):
    """
    Immutable audit history of state machine transitions for an application.
    """
    __tablename__ = "application_status_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[str] = mapped_column(String(100), nullable=False)  # 'citizen', 'officer', 'system'
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationship
    application: Mapped["Application"] = relationship("Application", back_populates="status_history")


# ─── 7. Uploaded Document ────────────────────────────────────────────────────
class UploadedDocument(Base):
    """
    Private document stored on disk with UUID filename.
    Never exposed through public URLs; access requires citizen owner or authorized officer.
    """
    __tablename__ = "uploaded_documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("citizens.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True, index=True)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. <uuid>.pdf
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ocr_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    ocr_extracted_fields: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    validation_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    validation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    citizen_confirmed_fields: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=None, nullable=True)
    confirmation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    citizen: Mapped["Citizen"] = relationship("Citizen", back_populates="documents")
    application: Mapped[Optional["Application"]] = relationship("Application", back_populates="documents")


# ─── 8. Officer ──────────────────────────────────────────────────────────────
class Officer(Base):
    """
    Government official reviewing applications in their assigned jurisdiction.
    """
    __tablename__ = "officers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # 'panchayat_officer', 'tehsil_officer', 'state_admin'
    jurisdiction_district: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    jurisdiction_village: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationship
    assigned_applications: Mapped[List["Application"]] = relationship("Application", back_populates="officer")


# ─── 9. Role & Permission ────────────────────────────────────────────────────
class RolePermission(Base):
    """
    RBAC permission definitions for citizen and officer actions.
    """
    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    permission: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


# ─── 10. Audit Log ───────────────────────────────────────────────────────────
class AuditLog(Base):
    """
    Immutable audit log recording sensitive actions.
    Never logs plaintext PII, tokens, or credentials.
    """
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'citizen', 'officer', 'system'
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)
    target_entity: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


# ─── 11. Confirmation Token ──────────────────────────────────────────────────
class ConfirmationToken(Base):
    """
    Cryptographically secure, single-use, 5-minute confirmation token.
    Stores only the SHA-256 hash of the secret token.
    Prevents replay attacks and unauthorized official submissions.
    """
    __tablename__ = "confirmation_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("citizens.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    citizen: Mapped["Citizen"] = relationship("Citizen", back_populates="tokens")
    application: Mapped["Application"] = relationship("Application", back_populates="tokens")
