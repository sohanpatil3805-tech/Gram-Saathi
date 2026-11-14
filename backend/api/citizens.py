"""
Citizen profile and authentication API endpoints for Gram Saathi.
Implements phone-based OTP authentication, JWT session issuance, and profile management.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.session import get_db
from backend.db.models import Citizen, CitizenProfile
from backend.auth.security import create_citizen_token, get_current_citizen
from backend.services import otp_service
from backend.api.schemas import (
    CitizenCreateRequest,
    CitizenResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
    CitizenProfileUpdateRequest,
    CitizenMeResponse,
)

citizens_router = APIRouter(prefix="/citizens", tags=["citizens"])


# ─── 1. OTP Authentication Endpoints ─────────────────────────────────────────

@citizens_router.post("/send-otp", response_model=SendOtpResponse)
def send_otp(payload: SendOtpRequest) -> SendOtpResponse:
    """
    Send a 6-digit OTP to the provided E.164 phone number.
    In DEMO_MODE: returns dev_otp in the response body for local development and testing.
    In PROD_MODE: logs OTP delivery stub; dev_otp is omitted.
    """
    try:
        otp = otp_service.generate_otp(payload.phone)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate OTP: {str(exc)}",
        )

    # In DEMO mode: expose dev_otp for developer ease
    dev_otp = otp if settings.demo_mode else None

    return SendOtpResponse(
        message="OTP sent successfully.",
        dev_otp=dev_otp,
    )


@citizens_router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(
    payload: VerifyOtpRequest,
    db: Session = Depends(get_db),
) -> VerifyOtpResponse:
    """
    Verify citizen OTP. On success:
    - Finds or creates Citizen record by phone
    - Issues a 30-day citizen JWT
    - Returns access_token, citizen_id, and is_new_citizen flag
    """
    try:
        is_valid = otp_service.verify_otp(payload.phone, payload.otp)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please check the code or request a new one.",
        )

    # Find or create citizen record
    citizen = db.query(Citizen).filter_by(phone_number=payload.phone).first()
    is_new = False

    if not citizen:
        is_new = True
        citizen = Citizen(
            phone_number=payload.phone,
            preferred_language="en",
            state="Karnataka",
        )
        db.add(citizen)
        db.commit()
        db.refresh(citizen)

        # Create empty profile
        profile = CitizenProfile(citizen_id=citizen.id)
        db.add(profile)
        db.commit()

    # Issue 30-day citizen JWT
    token = create_citizen_token(citizen_id=citizen.id, phone=citizen.phone_number)

    return VerifyOtpResponse(
        access_token=token,
        token_type="bearer",
        citizen_id=citizen.id,
        is_new_citizen=is_new,
    )


# ─── 2. Authenticated Citizen Profile Endpoints ──────────────────────────────

@citizens_router.get("/me", response_model=CitizenMeResponse)
def get_current_citizen_profile(
    citizen_id: uuid.UUID = Depends(get_current_citizen),
    db: Session = Depends(get_db),
) -> CitizenMeResponse:
    """
    Retrieve authenticated citizen profile using the bearer JWT.
    Returns identity and socio-economic profile data.
    """
    citizen = db.query(Citizen).filter_by(id=citizen_id, is_deleted=False).first()
    if not citizen:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found.")

    profile = db.query(CitizenProfile).filter_by(citizen_id=citizen.id).first()

    return CitizenMeResponse(
        id=citizen.id,
        phone_number=citizen.phone_number,
        name=citizen.name,
        preferred_language=citizen.preferred_language,
        citizen_group=citizen.citizen_group,
        state=citizen.state,
        district=citizen.district,
        village=citizen.village,
        aadhaar_ref=citizen.aadhaar_ref,
        created_at=citizen.created_at,
        updated_at=citizen.updated_at,
        annual_income=profile.annual_income if profile else None,
        land_holding_acres=float(profile.land_holding_acres) if (profile and profile.land_holding_acres is not None) else None,
        caste_category=profile.caste_category if profile else None,
        is_bpl=profile.is_bpl if profile else None,
        education_level=profile.education_level if profile else None,
        is_differently_abled=profile.is_differently_abled if profile else False,
        has_bank_account=profile.has_bank_account if profile else None,
    )


@citizens_router.put("/me", response_model=CitizenMeResponse)
def update_current_citizen_profile(
    payload: CitizenProfileUpdateRequest,
    citizen_id: uuid.UUID = Depends(get_current_citizen),
    db: Session = Depends(get_db),
) -> CitizenMeResponse:
    """
    Update profile fields for the authenticated citizen.
    Permits updating name, language, district, state, village, and socio-economic facts.
    Explicitly ignores phone number and Aadhaar numbers to maintain security.
    """
    citizen = db.query(Citizen).filter_by(id=citizen_id, is_deleted=False).first()
    if not citizen:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found.")

    profile = db.query(CitizenProfile).filter_by(citizen_id=citizen.id).first()
    if not profile:
        profile = CitizenProfile(citizen_id=citizen.id)
        db.add(profile)

    # Update citizen identity fields (never phone or Aadhaar)
    if payload.name is not None:
        citizen.name = payload.name
    if payload.preferred_language is not None:
        citizen.preferred_language = payload.preferred_language
    if payload.district is not None:
        citizen.district = payload.district
    if payload.state is not None:
        citizen.state = payload.state
    if payload.village is not None:
        citizen.village = payload.village
    if payload.citizen_group is not None:
        citizen.citizen_group = payload.citizen_group

    # Update socio-economic profile fields
    if payload.annual_income is not None:
        profile.annual_income = payload.annual_income
    if payload.land_holding_acres is not None:
        profile.land_holding_acres = payload.land_holding_acres
    if payload.caste_category is not None:
        profile.caste_category = payload.caste_category
    if payload.is_bpl is not None:
        profile.is_bpl = payload.is_bpl
    if payload.education_level is not None:
        profile.education_level = payload.education_level
    if payload.is_differently_abled is not None:
        profile.is_differently_abled = payload.is_differently_abled
    if payload.has_bank_account is not None:
        profile.has_bank_account = payload.has_bank_account

    db.commit()
    db.refresh(citizen)
    db.refresh(profile)

    return CitizenMeResponse(
        id=citizen.id,
        phone_number=citizen.phone_number,
        name=citizen.name,
        preferred_language=citizen.preferred_language,
        citizen_group=citizen.citizen_group,
        state=citizen.state,
        district=citizen.district,
        village=citizen.village,
        aadhaar_ref=citizen.aadhaar_ref,
        created_at=citizen.created_at,
        updated_at=citizen.updated_at,
        annual_income=profile.annual_income,
        land_holding_acres=float(profile.land_holding_acres) if profile.land_holding_acres is not None else None,
        caste_category=profile.caste_category,
        is_bpl=profile.is_bpl,
        education_level=profile.education_level,
        is_differently_abled=profile.is_differently_abled,
        has_bank_account=profile.has_bank_account,
    )


# ─── 3. Existing Legacy Endpoints (Preserved for compatibility) ──────────────

@citizens_router.post("", response_model=CitizenResponse, status_code=status.HTTP_201_CREATED)
def create_or_get_citizen(
    payload: CitizenCreateRequest,
    db: Session = Depends(get_db),
) -> CitizenResponse:
    """
    Register a new citizen or retrieve an existing citizen by phone number.
    Ensures Aadhaar is stored masked only.
    """
    citizen = db.query(Citizen).filter_by(phone_number=payload.phone_number).first()
    if citizen:
        # Update mutable fields if provided
        if payload.name:
            citizen.name = payload.name
        if payload.preferred_language:
            citizen.preferred_language = payload.preferred_language
        if payload.citizen_group:
            citizen.citizen_group = payload.citizen_group
        if payload.district:
            citizen.district = payload.district
        if payload.village:
            citizen.village = payload.village
        if payload.aadhaar_masked:
            citizen.aadhaar_ref = payload.aadhaar_masked
        db.commit()
        db.refresh(citizen)
        return CitizenResponse(
            id=citizen.id,
            phone_number=citizen.phone_number,
            name=citizen.name,
            preferred_language=citizen.preferred_language,
            citizen_group=citizen.citizen_group,
            state=citizen.state,
            district=citizen.district,
            village=citizen.village,
            aadhaar_ref=citizen.aadhaar_ref,
            created_at=citizen.created_at,
        )

    citizen = Citizen(
        phone_number=payload.phone_number,
        name=payload.name,
        preferred_language=payload.preferred_language,
        citizen_group=payload.citizen_group,
        state=payload.state,
        district=payload.district,
        village=payload.village,
        aadhaar_ref=payload.aadhaar_masked,
    )
    db.add(citizen)
    db.commit()
    db.refresh(citizen)

    # Initialize empty profile
    profile = CitizenProfile(citizen_id=citizen.id)
    db.add(profile)
    db.commit()

    return CitizenResponse(
        id=citizen.id,
        phone_number=citizen.phone_number,
        name=citizen.name,
        preferred_language=citizen.preferred_language,
        citizen_group=citizen.citizen_group,
        state=citizen.state,
        district=citizen.district,
        village=citizen.village,
        aadhaar_ref=citizen.aadhaar_ref,
        created_at=citizen.created_at,
    )


@citizens_router.get("/{citizen_id}", response_model=CitizenResponse)
def get_citizen(
    citizen_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> CitizenResponse:
    """Retrieve citizen profile by ID."""
    citizen = db.query(Citizen).filter_by(id=citizen_id, is_deleted=False).first()
    if not citizen:
        raise HTTPException(status_code=404, detail="Citizen not found.")
    return CitizenResponse(
        id=citizen.id,
        phone_number=citizen.phone_number,
        name=citizen.name,
        preferred_language=citizen.preferred_language,
        citizen_group=citizen.citizen_group,
        state=citizen.state,
        district=citizen.district,
        village=citizen.village,
        aadhaar_ref=citizen.aadhaar_ref,
        created_at=citizen.created_at,
    )
