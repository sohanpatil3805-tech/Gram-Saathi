"""
Tests for citizen OTP authentication, citizen JWT, profile management, and officer endpoints.
"""
from __future__ import annotations

import os
import uuid
import pytest
from starlette.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import create_app
from backend.db.base import Base
from backend.db.session import get_db
from backend.db.models import Citizen, CitizenProfile, Officer, Application
from backend.services.otp_service import generate_otp
from backend.auth.security import create_access_token, create_officer_token, hash_password


@pytest.fixture(scope="function")
def test_db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db_session):
    app = create_app()

    def override_get_db():
        try:
            yield test_db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_send_otp_success_and_dev_mode(client):
    """Test sending OTP with a valid Indian phone number."""
    response = client.post("/api/citizens/send-otp", json={"phone": "+919876543210"})
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    # In demo/dev mode, dev_otp is populated
    assert "dev_otp" in data


def test_send_otp_invalid_phone(client):
    """Test sending OTP with invalid phone formats."""
    response = client.post("/api/citizens/send-otp", json={"phone": "123"})
    assert response.status_code == 422 or response.status_code == 400


def test_verify_otp_and_issue_jwt(client):
    """Test verifying OTP creates citizen and returns valid JWT token."""
    phone = "+919876543210"
    otp = generate_otp(phone)

    response = client.post("/api/citizens/verify-otp", json={"phone": phone, "otp": otp})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "citizen_id" in data
    assert data["is_new_citizen"] is True


def test_verify_otp_invalid(client):
    """Test verifying OTP with incorrect code fails."""
    phone = "+919876543211"
    generate_otp(phone)

    response = client.post("/api/citizens/verify-otp", json={"phone": phone, "otp": "000000"})
    assert response.status_code == 400


def test_citizen_profile_me_get_and_put(client, test_db_session):
    """Test authenticated citizen can view and update their own profile."""
    citizen = Citizen(
        phone_number="+919876543212",
        name="Ramu Nayak",
        preferred_language="kn",
        citizen_group="farmer",
        state="Karnataka",
        district="Mandya",
        village="Shivalli",
    )
    test_db_session.add(citizen)
    test_db_session.commit()
    test_db_session.refresh(citizen)

    token = create_access_token({
        "sub": str(citizen.id),
        "phone": citizen.phone_number,
        "type": "citizen",
    })

    headers = {"Authorization": f"Bearer {token}"}

    # GET /api/citizens/me
    get_res = client.get("/api/citizens/me", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["name"] == "Ramu Nayak"
    assert data["preferred_language"] == "kn"

    # PUT /api/citizens/me
    update_res = client.put(
        "/api/citizens/me",
        headers=headers,
        json={"name": "Ramu Gowda", "preferred_language": "en", "district": "Mysuru"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Ramu Gowda"
    assert updated_data["preferred_language"] == "en"
    assert updated_data["district"] == "Mysuru"


def test_citizen_me_unauthorized(client):
    """Test /api/citizens/me fails without authentication token."""
    response = client.get("/api/citizens/me")
    assert response.status_code == 401


def test_officer_dashboard_stats_and_citizens(client, test_db_session):
    """Test officer dashboard stats and citizen listing with masking."""
    officer = Officer(
        username="tehsil_mandya",
        hashed_password=hash_password("GovSecure#2026"),
        full_name="Tehsil Officer Mandya",
        role="tehsil_officer",
        jurisdiction_district="Mandya",
    )
    citizen = Citizen(
        phone_number="+919876543210",
        name="Ramu Nayak",
        district="Mandya",
    )
    test_db_session.add_all([officer, citizen])
    test_db_session.commit()

    officer_token = create_officer_token(
        officer_id=officer.id,
        role=officer.role,
        username=officer.username,
        district=officer.jurisdiction_district,
    )
    headers = {"Authorization": f"Bearer {officer_token}"}

    # Dashboard stats
    stats_res = client.get("/api/officers/dashboard-stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_applications" in stats
    assert "total_citizens" in stats
    assert stats["total_citizens"] >= 1

    # Citizens list
    citizens_res = client.get("/api/officers/citizens", headers=headers)
    assert citizens_res.status_code == 200
    c_data = citizens_res.json()
    assert "citizens" in c_data
    assert len(c_data["citizens"]) >= 1
    # Verify phone masking
    assert "XXXX" in c_data["citizens"][0]["phone_masked"]
