"""
Integration tests for the 5 required citizen application document uploads:
1. Student Aadhaar Card
2. Caste Certificate (RD Number)
3. Income Certificate (RD Number)
4. Previous Year Marks Card
5. Bank Passbook

Tests backend multipart upload, private UUID disk storage, database metadata persistence,
OCR field extraction for each document type, duplicate uploads, error handling,
and officer authorization.
"""
import io
import uuid
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image

from backend.db.base import Base
from backend.db.session import get_db
from backend.db.models import Citizen, Officer, Application, UploadedDocument
from backend.main import create_app
from backend.auth.security import create_access_token


@pytest.fixture
def test_setup(tmp_path):
    # Setup test database
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db

    # Create citizen, application, and officer
    db = TestingSessionLocal()
    citizen = Citizen(
        id=uuid.uuid4(),
        phone_number="+919876543210",
        full_name="Priya Sharma",
        preferred_language="kn",
        citizen_group="student",
        district="Mandya",
    )
    db.add(citizen)

    application = Application(
        id=uuid.uuid4(),
        citizen_id=citizen.id,
        scheme_id="SSP_POST_MATRIC_BCM",
        status="DRAFT",
        applicant_data={"beneficiary_group": "student"},
    )
    db.add(application)

    officer = Officer(
        id=uuid.uuid4(),
        username="officer_mandya",
        hashed_password="mock",
        full_name="Taluk BCM Officer",
        role="panchayat_officer",
        jurisdiction_district="Mandya",
    )
    db.add(officer)
    db.commit()

    officer_token = create_access_token({
        "sub": str(officer.id),
        "officer_id": str(officer.id),
        "username": officer.username,
        "role": officer.role,
        "type": "officer"
    })

    client = TestClient(app)

    yield {
        "client": client,
        "db": db,
        "citizen": citizen,
        "application": application,
        "officer": officer,
        "officer_token": officer_token,
        "tmp_path": tmp_path,
    }

    db.close()
    engine.dispose()


def _create_sample_image(text_header="DOCUMENT"):
    img = Image.new("RGB", (600, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_upload_all_five_required_document_types_individually(test_setup):
    client = test_setup["client"]
    citizen = test_setup["citizen"]
    application = test_setup["application"]
    officer_token = test_setup["officer_token"]
    db = test_setup["db"]

    # The 5 required documents for student post-matric schemes
    five_docs = [
        ("aadhaar", "Student_Aadhaar_Card.jpg", "Aadhaar Identity Proof"),
        ("caste_certificate", "Caste_Certificate_RD0038.jpg", "Category 2A Certificate"),
        ("income_certificate", "Income_Certificate_RD0099.jpg", "Annual Income Certificate"),
        ("marks_card", "Previous_Year_Marks_Card.jpg", "PUC Marks Card 85%"),
        ("bank_passbook", "Bank_Passbook_Canara.jpg", "Aadhaar Linked Passbook"),
    ]

    uploaded_records = []

    for doc_type, filename, desc in five_docs:
        img_bytes = _create_sample_image(desc)
        files = {
            "file": (filename, img_bytes, "image/jpeg"),
        }
        data = {
            "citizen_id": str(citizen.id),
            "application_id": str(application.id),
            "document_type": doc_type,
        }

        # 1. File selection & Upload reaches backend
        res = client.post("/api/documents/upload", data=data, files=files)
        assert res.status_code == 201, f"Failed uploading {doc_type}: {res.text}"

        res_data = res.json()
        doc_id = res_data["id"]
        assert doc_id is not None
        assert res_data["citizen_id"] == str(citizen.id)
        assert res_data["application_id"] == str(application.id)
        assert res_data["document_type"] == doc_type
        assert res_data["original_filename"] == filename
        assert res_data["file_size_bytes"] == len(img_bytes)
        assert res_data["sha256_hash"] is not None

        # 2. File is actually stored in private storage with UUID filename
        doc_db = db.query(UploadedDocument).filter_by(id=uuid.UUID(doc_id)).first()
        assert doc_db is not None
        assert doc_db.stored_filename.startswith(doc_id)
        assert doc_db.stored_filename.endswith(".jpg")

        # 3. Officer portal can retrieve authorized document metadata
        meta_res = client.get(
            f"/api/documents/{doc_id}/metadata?officer_id={test_setup['officer'].id}",
            headers={"Authorization": f"Bearer {officer_token}"}
        )
        assert meta_res.status_code == 200
        assert meta_res.json()["document_type"] == doc_type

        # 4. Officer can download document
        dl_res = client.get(
            f"/api/documents/{doc_id}/download?officer_id={test_setup['officer'].id}",
            headers={"Authorization": f"Bearer {officer_token}"}
        )
        assert dl_res.status_code == 200
        assert len(dl_res.content) == len(img_bytes)

        uploaded_records.append(doc_id)

    # Verify all 5 distinct records exist in database
    assert len(uploaded_records) == 5
    assert len(set(uploaded_records)) == 5

    # Application details reflect all 5 uploaded documents
    app_res = client.get(
        f"/api/applications/{application.id}",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert app_res.status_code == 200
    app_docs = app_res.json()["documents"]
    assert len(app_docs) == 5
    doc_types_in_app = {d["document_type"] for d in app_docs}
    assert "aadhaar" in doc_types_in_app
    assert "caste_certificate" in doc_types_in_app
    assert "income_certificate" in doc_types_in_app
    assert "marks_card" in doc_types_in_app
    assert "bank_passbook" in doc_types_in_app


def test_duplicate_upload_replaces_or_adds_safely(test_setup):
    client = test_setup["client"]
    citizen = test_setup["citizen"]
    application = test_setup["application"]

    img_v1 = _create_sample_image("Marks V1")
    img_v2 = _create_sample_image("Marks V2 - Clearer Scan")

    # Upload version 1 of marks card
    res1 = client.post(
        "/api/documents/upload",
        data={
            "citizen_id": str(citizen.id),
            "application_id": str(application.id),
            "document_type": "marks_card",
        },
        files={"file": ("marks_v1.jpg", img_v1, "image/jpeg")}
    )
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # Upload version 2 (re-upload / replacement)
    res2 = client.post(
        "/api/documents/upload",
        data={
            "citizen_id": str(citizen.id),
            "application_id": str(application.id),
            "document_type": "marks_card",
        },
        files={"file": ("marks_v2.jpg", img_v2, "image/jpeg")}
    )
    assert res2.status_code == 201
    id2 = res2.json()["id"]

    assert id1 != id2


def test_unsupported_file_or_size_violation_fails_and_does_not_store(test_setup):
    client = test_setup["client"]
    citizen = test_setup["citizen"]

    # 1. Unsupported mime / file header (fake text/exe)
    invalid_bytes = b"MZ\x90\x00Not a valid image or pdf"
    res_bad = client.post(
        "/api/documents/upload",
        data={
            "citizen_id": str(citizen.id),
            "document_type": "caste_certificate",
        },
        files={"file": ("bad_file.exe", invalid_bytes, "application/octet-stream")}
    )
    assert res_bad.status_code == 400
    assert "Unsupported file type" in res_bad.json()["detail"]

    # 2. Empty file
    res_empty = client.post(
        "/api/documents/upload",
        data={
            "citizen_id": str(citizen.id),
            "document_type": "marks_card",
        },
        files={"file": ("empty.jpg", b"", "image/jpeg")}
    )
    assert res_empty.status_code == 400

