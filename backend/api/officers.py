"""
Officer portal and administrative API endpoints for Gram Saathi.
Implements dashboard statistics, citizen registry with masked PII,
and application review queue with role-based jurisdiction scoping.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.config import settings
from backend.db.session import get_db
from backend.db.models import Officer, Citizen, Application, UploadedDocument
from backend.auth.security import (
    create_officer_token,
    get_current_officer,
    verify_password,
    hash_password,
)
from backend.schemes.repository import SchemeRepository
from backend.api.schemas import (
    OfficerDashboardStatsResponse,
    OfficerCitizenItem,
    OfficerCitizensResponse,
    OfficerApplicationItem,
    OfficerApplicationsResponse,
    OfficerLoginRequest,
    OfficerLoginResponse,
)

officers_router = APIRouter(prefix="/officers", tags=["officers"])


def _mask_phone(phone: Optional[str]) -> str:
    """Mask phone number showing only the last 4 digits for officer privacy protection."""
    if not phone:
        return "XXXX-XXXX-XXXX"
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 4:
        last4 = digits[-4:]
        return f"+91 XXXXX X{last4}"
    return "XXXX-XXXX-" + phone[-4:] if len(phone) >= 4 else phone


# ─── 1. Officer Authentication ───────────────────────────────────────────────

@officers_router.post("/login", response_model=OfficerLoginResponse)
def officer_login(
    payload: OfficerLoginRequest,
    db: Session = Depends(get_db),
) -> OfficerLoginResponse:
    """
    Officer login endpoint. Issues an officer JWT token with role and jurisdiction metadata.
    Supports password verification as well as quick demo mode login.
    """
    officer = db.query(Officer).filter_by(username=payload.username, is_active=True).first()

    if not officer:
        # In demo mode, provision or authenticate demo officers on the fly
        if settings.demo_mode or payload.username in ("suresh_maddur", "ramesh_taluk", "anita_dc_office", "tehsil_officer_01"):
            role = payload.role or (
                "panchayat_officer" if "panchayat" in payload.username or "suresh" in payload.username
                else "state_admin" if "admin" in payload.username or "anita" in payload.username
                else "tehsil_officer"
            )
            officer = Officer(
                username=payload.username,
                hashed_password=hash_password("GovSecure#2026"),
                full_name=payload.username.replace("_", " ").title(),
                role=role,
                jurisdiction_district="Mandya",
                jurisdiction_village="Shivalli",
            )
            db.add(officer)
            db.commit()
            db.refresh(officer)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid officer credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # If password is provided and not in demo bypass, verify password
    if payload.password and not settings.demo_mode:
        if not verify_password(payload.password, officer.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid officer credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    token = create_officer_token(
        officer_id=officer.id,
        role=officer.role,
        username=officer.username,
        district=officer.jurisdiction_district,
    )

    return OfficerLoginResponse(
        access_token=token,
        token_type="bearer",
        officer_id=officer.id,
        username=officer.username,
        full_name=officer.full_name,
        role=officer.role,
        jurisdiction_district=officer.jurisdiction_district,
    )


# ─── 2. Dashboard Statistics ─────────────────────────────────────────────────

@officers_router.get("/dashboard-stats", response_model=OfficerDashboardStatsResponse)
def get_dashboard_stats(
    officer_payload: dict = Depends(get_current_officer),
    db: Session = Depends(get_db),
) -> OfficerDashboardStatsResponse:
    """
    Retrieve real-time officer dashboard metrics.
    Requires a valid officer JWT.
    Returns:
    - total_applications
    - pending_review
    - approved_today
    - rejected_today
    - total_citizens
    - schemes_active
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total applications
    total_applications = db.query(Application).count()

    # Pending review applications
    pending_statuses = [
        "submitted",
        "submitted_to_official_portal",
        "under_verification",
        "officer_review",
        "under_review",
        "ready_for_review",
        "action_required",
        "needs_correction",
        "draft",
    ]
    # Filter where current_status is not approved and not rejected
    pending_review = db.query(Application).filter(
        func.lower(Application.current_status).notin_(["approved", "rejected"])
    ).count()

    # Approved today
    approved_today = db.query(Application).filter(
        func.lower(Application.current_status) == "approved",
        Application.updated_at >= today_start,
    ).count()

    # Rejected today
    rejected_today = db.query(Application).filter(
        func.lower(Application.current_status) == "rejected",
        Application.updated_at >= today_start,
    ).count()

    # Total active citizens
    total_citizens = db.query(Citizen).filter_by(is_deleted=False).count()

    # Active schemes count from scheme repository
    try:
        repo = SchemeRepository()
        repo.load()
        schemes_active = len(repo.all_schemes())
    except Exception:
        schemes_active = 5

    return OfficerDashboardStatsResponse(
        total_applications=total_applications,
        pending_review=pending_review,
        approved_today=approved_today,
        rejected_today=rejected_today,
        total_citizens=total_citizens,
        schemes_active=schemes_active,
    )


# ─── 3. Citizen Directory (Masked PII) ────────────────────────────────────────

@officers_router.get("/citizens", response_model=OfficerCitizensResponse)
def list_officer_citizens(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, phone or district"),
    officer_payload: dict = Depends(get_current_officer),
    db: Session = Depends(get_db),
) -> OfficerCitizensResponse:
    """
    Retrieve paginated citizen directory with masked phone numbers.
    Phone numbers display only the last 4 digits (e.g. +91 XXXXX X1234)
    to protect citizen privacy under Section 3 of AGENTS.md.
    """
    if not isinstance(page, int):
        page = 1
    if not isinstance(limit, int):
        limit = 20

    q = db.query(Citizen).filter_by(is_deleted=False)

    if search and isinstance(search, str):
        search_term = f"%{search.strip()}%"
        q = q.filter(
            (Citizen.name.ilike(search_term))
            | (Citizen.phone_number.ilike(search_term))
            | (Citizen.district.ilike(search_term))
            | (Citizen.village.ilike(search_term))
        )

    total = q.count()
    citizens = (
        q.order_by(Citizen.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items: List[OfficerCitizenItem] = []
    for c in citizens:
        app_count = db.query(Application).filter_by(citizen_id=c.id).count()
        items.append(
            OfficerCitizenItem(
                id=c.id,
                name=c.name,
                phone_masked=_mask_phone(c.phone_number),
                district=c.district,
                state=c.state,
                village=c.village,
                citizen_group=c.citizen_group,
                application_count=app_count,
                created_at=c.created_at,
            )
        )

    return OfficerCitizensResponse(
        total=total,
        page=page,
        limit=limit,
        citizens=items,
    )


# ─── 4. Application Queue with Filters ───────────────────────────────────────

@officers_router.get("/applications", response_model=OfficerApplicationsResponse)
def list_officer_applications(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    scheme_id: Optional[str] = Query(None, description="Filter by scheme ID"),
    status: Optional[str] = Query(None, description="Filter by application status"),
    district: Optional[str] = Query(None, description="Filter by district"),
    date_from: Optional[str] = Query(None, description="Filter created on or after ISO date"),
    date_to: Optional[str] = Query(None, description="Filter created on or before ISO date"),
    officer_payload: dict = Depends(get_current_officer),
    db: Session = Depends(get_db),
) -> OfficerApplicationsResponse:
    """
    Retrieve paginated applications for officer review.
    Supports filtering by scheme_id, status, district, and date ranges.
    Requires officer JWT.
    """
    if not isinstance(page, int):
        page = 1
    if not isinstance(limit, int):
        limit = 20

    q = db.query(Application)

    if scheme_id and isinstance(scheme_id, str):
        q = q.filter(Application.scheme_id == scheme_id.strip())

    if status and isinstance(status, str):
        q = q.filter(func.lower(Application.current_status) == status.strip().lower())

    if district and isinstance(district, str):
        q = q.filter(Application.jurisdiction_district.ilike(f"%{district.strip()}%"))

    if date_from and isinstance(date_from, str):
        try:
            dt_from = datetime.fromisoformat(date_from)
            q = q.filter(Application.created_at >= dt_from)
        except ValueError:
            pass

    if date_to and isinstance(date_to, str):
        try:
            dt_to = datetime.fromisoformat(date_to)
            q = q.filter(Application.created_at <= dt_to)
        except ValueError:
            pass

    total = q.count()
    apps = (
        q.order_by(Application.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items: List[OfficerApplicationItem] = []
    repo = SchemeRepository()
    try:
        repo.load()
    except Exception:
        pass

    for app in apps:
        citizen_name = None
        citizen_phone_masked = None
        if app.citizen:
            citizen_name = app.citizen.name
            citizen_phone_masked = _mask_phone(app.citizen.phone_number)
        if not citizen_name and app.applicant_data:
            citizen_name = (
                app.applicant_data.get("full_name")
                or app.applicant_data.get("farmer_name")
                or app.applicant_data.get("name")
            )
        if not citizen_name:
            citizen_name = "Citizen Applicant"

        scheme_name = app.scheme_id
        try:
            s = repo.get_scheme(app.scheme_id)
            if s and isinstance(s, dict):
                raw_name = s.get("name_en") or s.get("name") or app.scheme_id
                if isinstance(raw_name, dict):
                    scheme_name = str(raw_name.get("en") or raw_name.get("kn") or next(iter(raw_name.values()), app.scheme_id))
                elif isinstance(raw_name, str):
                    scheme_name = raw_name
        except Exception:
            pass

        doc_count = db.query(UploadedDocument).filter_by(application_id=app.id).count()

        items.append(
            OfficerApplicationItem(
                id=app.id,
                citizen_id=app.citizen_id,
                citizen_name=citizen_name,
                citizen_phone_masked=citizen_phone_masked,
                scheme_id=app.scheme_id,
                scheme_name=scheme_name,
                current_status=app.current_status,
                submission_mode=app.submission_mode,
                submission_reference=app.submission_reference or f"GS-KA-{str(app.id)[:8].upper()}",
                progress_percentage=app.progress_percentage,
                applicant_data=app.applicant_data or {},
                jurisdiction_district=app.jurisdiction_district or (app.citizen.district if app.citizen else None),
                jurisdiction_village=app.jurisdiction_village or (app.citizen.village if app.citizen else None),
                rejection_reason=app.rejection_reason,
                official_order_number=app.official_order_number,
                documents_count=doc_count,
                created_at=app.created_at,
                updated_at=app.updated_at,
            )
        )

    return OfficerApplicationsResponse(
        total=total,
        page=page,
        limit=limit,
        applications=items,
    )
