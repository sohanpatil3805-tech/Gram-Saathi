"""
Pydantic v2 schemas for Gram Saathi API endpoints.
Enforces strict input validation, data masking, and safe error representations.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


def normalize_language_code(value: Any) -> str:
    """Normalize language inputs to 'en', 'kn', or 'hi'."""
    if not isinstance(value, str):
        raise ValueError("language must be a string")
    code = value.strip().lower()
    if "-" in code:
        code = code.split("-")[0]
    if "_" in code:
        code = code.split("_")[0]
    if code in ("kannada", "kn"):
        return "kn"
    if code in ("hindi", "hi"):
        return "hi"
    if code in ("english", "en"):
        return "en"
    if code in ("en", "kn", "hi"):
        return code
    raise ValueError("language must be one of 'en', 'kn', or 'hi'")


# ─── Citizen Schemas ──────────────────────────────────────────────────────────
class CitizenCreateRequest(BaseModel):
    phone_number: str = Field(..., description="E.164 phone number e.g. +919876543210")
    name: Optional[str] = Field(None, max_length=100)
    preferred_language: str = Field(default="en")
    citizen_group: Optional[str] = Field(None, max_length=50)
    state: str = Field(default="Karnataka", max_length=50)
    district: Optional[str] = Field(None, max_length=50)
    village: Optional[str] = Field(None, max_length=100)
    aadhaar_masked: Optional[str] = Field(None, max_length=20, description="Masked format XXXX-XXXX-1234 only")

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = v.strip().replace(" ", "").replace("-", "")
        if not re.match(r"^\+?[1-9]\d{7,14}$", clean):
            raise ValueError("Invalid phone number format. Must be E.164 compliant.")
        return clean

    @field_validator("preferred_language", mode="before")
    @classmethod
    def validate_lang(cls, v: Any) -> str:
        return normalize_language_code(v)

    @field_validator("aadhaar_masked")
    @classmethod
    def validate_aadhaar(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        # Ensure it's not a full 12-digit plaintext Aadhaar
        if re.match(r"^\d{12}$", trimmed):
            raise ValueError("Never provide full 12-digit Aadhaar. Use masked format XXXX-XXXX-1234.")
        return trimmed


class CitizenResponse(BaseModel):
    id: uuid.UUID
    phone_number: str
    name: Optional[str] = None
    preferred_language: str
    citizen_group: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    aadhaar_ref: Optional[str] = None
    created_at: datetime


# ─── Conversation Schemas ────────────────────────────────────────────────────
class ConversationCreateRequest(BaseModel):
    session_token: Optional[str] = Field(None, max_length=64)
    citizen_id: Optional[uuid.UUID] = None
    phone_number: Optional[str] = None
    language: str = Field(default="en")
    channel: str = Field(default="web")

    @field_validator("language", mode="before")
    @classmethod
    def validate_lang(cls, v: Any) -> str:
        return normalize_language_code(v)


class MessageSendRequest(BaseModel):
    sender: str = Field(default="citizen", pattern="^(citizen|assistant|system)$")
    content: str = Field(..., min_length=1, max_length=2000)
    content_type: str = Field(default="text", pattern="^(text|image|document|token_request)$")
    session_token: Optional[str] = None
    citizen_id: Optional[uuid.UUID] = None
    metadata: Optional[Dict[str, Any]] = None


class MessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sender: str
    content: str
    content_type: str
    metadata: Dict[str, Any]
    created_at: datetime


class ConversationSessionResponse(BaseModel):
    id: uuid.UUID
    session_token: str
    citizen_id: Optional[uuid.UUID] = None
    phone_number: Optional[str] = None
    channel: str
    language: str
    current_stage: str
    active_scheme_id: Optional[str] = None
    active_application_id: Optional[uuid.UUID] = None
    last_message_at: datetime
    created_at: datetime


# ─── Application Schemas ─────────────────────────────────────────────────────
class ApplicationDraftCreateRequest(BaseModel):
    citizen_id: uuid.UUID
    scheme_id: str = Field(..., min_length=1, max_length=100)
    applicant_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ApplicationDraftUpdateRequest(BaseModel):
    citizen_id: uuid.UUID
    applicant_data: Dict[str, Any]


class TokenRequest(BaseModel):
    citizen_id: uuid.UUID


class TokenResponse(BaseModel):
    application_id: uuid.UUID
    raw_token: str
    expires_at: datetime
    expiry_minutes: int
    instructions: str


class ApplicationSubmitRequest(BaseModel):
    citizen_id: Optional[uuid.UUID] = None
    confirmation_token: str = Field(..., min_length=10)
    target_status: Optional[str] = None


class OfficerDecisionRequest(BaseModel):
    officer_id: uuid.UUID
    decision: str = Field(..., pattern="^(approved|rejected|action_required|APPROVED|REJECTED|NEEDS_CORRECTION|needs_correction)$")
    remarks: Optional[str] = Field(None, max_length=1000)
    official_order_number: Optional[str] = Field(None, max_length=100)
    rejection_reason: Optional[str] = Field(None, max_length=1000)


class OfficerDecisionNewRequest(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED|NEEDS_CORRECTION|approved|rejected|needs_correction|action_required|APPROVE|REJECT|REQUEST_CORRECTION|approve|reject)$")
    notes: Optional[str] = Field(None, max_length=1000)
    order_number: Optional[str] = Field(None, max_length=100)


class TimelineItemResponse(BaseModel):
    timestamp: datetime
    status: str
    actor: str
    notes: Optional[str] = None


class ApplicationStatusHistoryResponse(BaseModel):
    id: uuid.UUID
    from_status: Optional[str] = None
    to_status: str
    remarks: Optional[str] = None
    changed_by: str
    created_at: datetime


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    scheme_id: str
    scheme_name: Optional[str] = None
    scheme_category: Optional[str] = None
    scheme_department: Optional[str] = None
    current_status: str
    submission_mode: str
    progress_percentage: int
    applicant_data: Dict[str, Any]
    submission_reference: Optional[str] = None
    submitted_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    official_order_number: Optional[str] = None
    is_simulated: bool
    created_at: datetime
    updated_at: datetime
    citizen_name: Optional[str] = None
    citizen_phone_masked: Optional[str] = None
    citizen_village: Optional[str] = None
    citizen_district: Optional[str] = None
    citizen_state: Optional[str] = None
    citizen_group: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = None
    timeline: Optional[List[Dict[str, Any]]] = None
    eligibility_evaluation: Optional[Dict[str, Any]] = None
    eligibility_score: Optional[int] = None
    required_documents_checklist: Optional[List[Dict[str, Any]]] = None


# ─── Document Schemas ────────────────────────────────────────────────────────
class DocumentResponse(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    application_id: Optional[uuid.UUID] = None
    document_type: str
    original_filename: str
    stored_filename: str
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    ocr_status: str
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: Optional[float] = None
    ocr_text: Optional[str] = None
    confirmed_fields: Optional[Dict[str, Any]] = None
    is_confirmed_by_user: bool = False
    confirmation_notes: Optional[str] = None
    validation_status: str
    created_at: datetime


class DocumentConfirmRequest(BaseModel):
    citizen_id: uuid.UUID
    confirmed_fields: Dict[str, Any] = Field(..., description="Citizen verified and corrected key-value fields")
    notes: Optional[str] = Field(None, max_length=500, description="Optional citizen notes or verification confirmation")


# ─── Citizen OTP & Profile Auth Schemas ─────────────────────────────────────
class SendOtpRequest(BaseModel):
    phone: str = Field(..., description="E.164 phone number e.g. +919876543210")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = v.strip().replace(" ", "").replace("-", "")
        if not re.match(r"^\+?[1-9]\d{7,14}$", clean):
            raise ValueError("Invalid phone number format. Must be E.164 compliant.")
        return clean


class SendOtpResponse(BaseModel):
    message: str
    dev_otp: Optional[str] = None


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., description="E.164 phone number e.g. +919876543210")
    otp: str = Field(..., min_length=4, max_length=10)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = v.strip().replace(" ", "").replace("-", "")
        if not re.match(r"^\+?[1-9]\d{7,14}$", clean):
            raise ValueError("Invalid phone number format. Must be E.164 compliant.")
        return clean


class VerifyOtpResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    citizen_id: uuid.UUID
    is_new_citizen: bool


class CitizenProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    preferred_language: Optional[str] = None
    district: Optional[str] = Field(None, max_length=50)
    state: Optional[str] = Field(None, max_length=50)
    village: Optional[str] = Field(None, max_length=100)
    citizen_group: Optional[str] = Field(None, max_length=50)
    annual_income: Optional[int] = None
    land_holding_acres: Optional[float] = None
    caste_category: Optional[str] = None
    is_bpl: Optional[bool] = None
    education_level: Optional[str] = None
    is_differently_abled: Optional[bool] = None
    has_bank_account: Optional[bool] = None

    @field_validator("preferred_language", mode="before")
    @classmethod
    def validate_lang(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return normalize_language_code(v)


class CitizenMeResponse(BaseModel):
    id: uuid.UUID
    phone_number: str
    name: Optional[str] = None
    preferred_language: str = "en"
    citizen_group: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    aadhaar_ref: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    annual_income: Optional[int] = None
    land_holding_acres: Optional[float] = None
    caste_category: Optional[str] = None
    is_bpl: Optional[bool] = None
    education_level: Optional[str] = None
    is_differently_abled: bool = False
    has_bank_account: Optional[bool] = None


# ─── Officer Schemas ────────────────────────────────────────────────────────
class OfficerDashboardStatsResponse(BaseModel):
    total_applications: int
    pending_review: int
    approved_today: int
    rejected_today: int
    total_citizens: int
    schemes_active: int


class OfficerCitizenItem(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    phone_masked: str
    district: Optional[str] = None
    state: Optional[str] = None
    village: Optional[str] = None
    citizen_group: Optional[str] = None
    application_count: int
    created_at: datetime


class OfficerCitizensResponse(BaseModel):
    total: int
    page: int
    limit: int
    citizens: List[OfficerCitizenItem]


class OfficerApplicationItem(BaseModel):
    id: uuid.UUID
    citizen_id: uuid.UUID
    citizen_name: Optional[str] = None
    citizen_phone_masked: Optional[str] = None
    scheme_id: str
    scheme_name: Optional[str] = None
    current_status: str
    submission_mode: str
    submission_reference: Optional[str] = None
    progress_percentage: int = 0
    applicant_data: Dict[str, Any] = Field(default_factory=dict)
    jurisdiction_district: Optional[str] = None
    jurisdiction_village: Optional[str] = None
    rejection_reason: Optional[str] = None
    official_order_number: Optional[str] = None
    documents_count: int = 0
    created_at: datetime
    updated_at: datetime


class OfficerApplicationsResponse(BaseModel):
    total: int
    page: int
    limit: int
    applications: List[OfficerApplicationItem]


class OfficerLoginRequest(BaseModel):
    username: str
    password: Optional[str] = None
    role: Optional[str] = None


class OfficerLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    officer_id: uuid.UUID
    username: str
    full_name: str
    role: str
    jurisdiction_district: Optional[str] = None

