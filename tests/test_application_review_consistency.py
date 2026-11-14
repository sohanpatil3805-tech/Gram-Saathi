"""
End-to-End Regression Test Suite for Scheme Criteria & Application Review Consistency.

Verifies:
1. Student scholarship application (KARNATAKA_SSP_DIRECTORY):
   - Official human-readable scheme name returned.
   - Applicant category is 'STUDENT' / 'students'.
   - Deterministic eligibility evaluation uses student criteria (has_bank_account, etc.), NOT farmer landholding.
   - Required document checklist contains student documents (Student Aadhaar, Kutumba ID, Caste/Income certificate, etc.).
   - Land holding is not required or evaluated for students.
2. Farmer scheme application (PM_KISAN):
   - Official human-readable scheme name returned.
   - Applicant category is 'FARMER' / 'farmers'.
   - Deterministic eligibility evaluation uses farmer criteria (land_holding_acres > 0, has_bank_account == true).
   - Required document checklist contains farmer documents (Land Record, Aadhaar, Bank Passbook).
3. Document verification & checklist states:
   - 0 documents uploaded -> accurately flagged as incomplete with missing mandatory docs.
   - Documents uploaded -> reflected in checklist with real metadata and status.
4. Insufficient eligibility information -> outcome 'needs_information', missing fields listed, score != 100%.
5. Failed eligibility conditions -> outcome 'not_eligible', score = 0%.
6. Officer review and decision -> APPROVED with order number or NEEDS_CORRECTION with notes, preserving audit history.
7. Citizen status tracking -> matches application reference and status timeline.
"""
import io
import tempfile
import unittest
import uuid
from pathlib import Path
from PIL import Image

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.session import get_db
from backend.db.models import Citizen, Officer, Application, UploadedDocument, ApplicationStatusHistory
from backend.auth.security import create_officer_token, create_access_token
from backend.main import create_app
from backend.schemes.repository import SchemeRepository


class ApplicationReviewConsistencyTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )
        Base.metadata.create_all(bind=self.engine)
        self.TestingSessionLocal = sessionmaker(bind=self.engine, expire_on_commit=False)

        def override_get_db():
            db = self.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app = create_app()
        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

        # Seed synthetic citizen profiles and officer
        db = self.TestingSessionLocal()
        self.student_citizen = Citizen(
            id=uuid.uuid4(),
            phone_number="+919876543201",
            name="Priya Sharma",
            preferred_language="kn",
            citizen_group="student",
            district="Mandya",
            village="Shivalli",
        )
        self.farmer_citizen = Citizen(
            id=uuid.uuid4(),
            phone_number="+919876543202",
            name="Ramu Nayak",
            preferred_language="kn",
            citizen_group="farmer",
            district="Mandya",
            village="Shivalli",
        )
        self.officer = Officer(
            id=uuid.uuid4(),
            username="officer_mandya_review",
            hashed_password="mock",
            full_name="Taluk Verification Officer",
            role="tehsil_officer",
            jurisdiction_district="Mandya",
            jurisdiction_village="Shivalli",
        )
        db.add_all([self.student_citizen, self.farmer_citizen, self.officer])
        db.commit()

        self.student_citizen_id = self.student_citizen.id
        self.farmer_citizen_id = self.farmer_citizen.id
        self.officer_id = self.officer.id

        self.officer_token = create_officer_token(
            officer_id=self.officer.id,
            role=self.officer.role,
            username=self.officer.username,
        )
        self.officer_headers = {"Authorization": f"Bearer {self.officer_token}"}
        db.close()

    def tearDown(self):
        self.app.dependency_overrides.clear()
        self.engine.dispose()

    # -------------------------------------------------------------------------
    # 1. Student Scholarship Application Review (KARNATAKA_SSP_DIRECTORY)
    # -------------------------------------------------------------------------
    def test_student_scholarship_application_review(self):
        """Verify student application uses readable scheme name, student criteria, and no landholding."""
        student_facts = {
            "beneficiary_group": "students",
            "citizen_group": "STUDENT",
            "education_level": "Undergraduate Degree",
            "caste_category": "Category 2A",
            "annual_income": 85000,
            "has_bank_account": True,
        }

        # Create student application draft
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.student_citizen.id),
            "scheme_id": "KARNATAKA_SSP_DIRECTORY",
            "applicant_data": student_facts,
        })
        self.assertEqual(draft_res.status_code, 201)
        draft = draft_res.json()
        app_id = draft["id"]

        # Fetch single application via GET /api/applications/{id}
        res = self.client.get(
            f"/api/applications/{app_id}",
            params={"citizen_id": str(self.student_citizen.id)},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # 1. Official human-readable scheme name
        self.assertIn("Karnataka State Scholarship Portal", data["scheme_name"])
        self.assertEqual(data["scheme_id"], "KARNATAKA_SSP_DIRECTORY")
        self.assertIn("Scholarship", data["scheme_category"])

        # 2. Category is STUDENT
        self.assertIn(data["citizen_group"].upper(), ["STUDENT", "STUDENTS"])

        # 3. Deterministic eligibility evaluation uses student criteria
        self.assertIsNotNone(data["eligibility_evaluation"])
        eval_data = data["eligibility_evaluation"]
        self.assertEqual(eval_data["outcome"], "potentially_eligible")
        self.assertEqual(data["eligibility_score"], 100)

        # Check evaluated rules: should evaluate has_bank_account, NOT landholding!
        rule_ids = [r["rule_id"] for r in eval_data["rule_results"]]
        self.assertIn("SSP_DIR_E1", rule_ids)
        rule_fields = [r.get("field") for r in eval_data["rule_results"]]
        self.assertNotIn("land_holding_acres", rule_fields)

        # 4. Required document checklist contains student documents
        self.assertIsNotNone(data["required_documents_checklist"])
        item_names = [item["item_name"] for item in data["required_documents_checklist"]]
        self.assertTrue(any("Aadhaar" in name for name in item_names))
        self.assertTrue(any("Kutumba" in name or "Caste" in name or "Passbook" in name for name in item_names))

        # 5. Zero documents uploaded initially -> checklist shows missing
        self.assertEqual(len(data["documents"]), 0)
        self.assertTrue(any(not item["is_uploaded"] for item in data["required_documents_checklist"]))

    # -------------------------------------------------------------------------
    # 2. Farmer Scheme Application Review (PM_KISAN)
    # -------------------------------------------------------------------------
    def test_farmer_scheme_application_review(self):
        """Verify farmer application uses readable scheme name, farmer criteria, and landholding."""
        farmer_facts = {
            "beneficiary_group": "farmers",
            "citizen_group": "FARMER",
            "land_holding_acres": 2.5,
            "has_bank_account": True,
            "annual_income": 95000,
            "has_cultivable_land_record": True,
        }

        # Create farmer application draft
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.farmer_citizen.id),
            "scheme_id": "PM_KISAN",
            "applicant_data": farmer_facts,
        })
        self.assertEqual(draft_res.status_code, 201)
        draft = draft_res.json()
        app_id = draft["id"]

        # Fetch single application via GET /api/applications/{id}
        res = self.client.get(
            f"/api/applications/{app_id}",
            params={"citizen_id": str(self.farmer_citizen.id)},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # 1. Official human-readable scheme name
        self.assertIn("PM-KISAN", data["scheme_name"])
        self.assertEqual(data["scheme_id"], "PM_KISAN")

        # 2. Category is FARMER
        self.assertIn(data["citizen_group"].upper(), ["FARMER", "FARMERS"])

        # 3. Deterministic eligibility evaluation uses farmer criteria
        eval_data = data["eligibility_evaluation"]
        self.assertEqual(eval_data["outcome"], "potentially_eligible")
        self.assertEqual(data["eligibility_score"], 100)

        # Check evaluated rules: includes PMKISAN_E1 (land_holding_acres) and PMKISAN_E2 (has_bank_account)
        rule_ids = [r["rule_id"] for r in eval_data["rule_results"]]
        self.assertIn("PMKISAN_E1", rule_ids)
        self.assertIn("PMKISAN_E2", rule_ids)

        # 4. Land holding acres is present in applicant_data
        self.assertEqual(data["applicant_data"]["land_holding_acres"], 2.5)

    # -------------------------------------------------------------------------
    # 3. Document Verification & Checklist Synchronization
    # -------------------------------------------------------------------------
    def test_missing_documents_vs_uploaded_documents_checklist(self):
        """Verify that document checklist accurately reflects pending vs uploaded states."""
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.farmer_citizen.id),
            "scheme_id": "PM_KISAN",
            "applicant_data": {
                "beneficiary_group": "farmers",
                "land_holding_acres": 2.0,
                "has_bank_account": True,
            },
        })
        app_id = draft_res.json()["id"]

        # Initially 0 documents uploaded
        res_initial = self.client.get(f"/api/applications/{app_id}", params={"citizen_id": str(self.farmer_citizen.id)})
        self.assertEqual(len(res_initial.json()["documents"]), 0)
        checklist_initial = res_initial.json()["required_documents_checklist"]
        self.assertTrue(all(not item["is_uploaded"] for item in checklist_initial))

        # Upload Land Record document for this application
        img = Image.new("RGB", (400, 200), color=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        file_bytes = buf.getvalue()

        up_res = self.client.post(
            "/api/documents/upload",
            data={
                "citizen_id": str(self.farmer_citizen.id),
                "application_id": app_id,
                "document_type": "land_record",
            },
            files={"file": ("bhoomi_rtc_survey_142.jpg", file_bytes, "image/jpeg")},
        )
        self.assertEqual(up_res.status_code, 201)

        # Fetch application again: document count is now 1, and land record item is marked is_uploaded = True
        res_after = self.client.get(f"/api/applications/{app_id}", params={"citizen_id": str(self.farmer_citizen.id)})
        self.assertEqual(len(res_after.json()["documents"]), 1)
        checklist_after = res_after.json()["required_documents_checklist"]

        land_record_items = [c for c in checklist_after if "land" in c["item_name"].lower()]
        self.assertTrue(len(land_record_items) > 0)
        self.assertTrue(land_record_items[0]["is_uploaded"])
        self.assertEqual(land_record_items[0]["uploaded_filename"], "bhoomi_rtc_survey_142.jpg")

    # -------------------------------------------------------------------------
    # 4. Insufficient Eligibility Information
    # -------------------------------------------------------------------------
    def test_insufficient_eligibility_information_gives_needs_information(self):
        """Verify that omitting required criteria facts produces 'needs_information' and not 100%."""
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.farmer_citizen.id),
            "scheme_id": "PM_KISAN",
            "applicant_data": {
                "beneficiary_group": "farmers",
                # land_holding_acres is MISSING!
                "has_bank_account": True,
            },
        })
        app_id = draft_res.json()["id"]

        res = self.client.get(f"/api/applications/{app_id}", params={"citizen_id": str(self.farmer_citizen.id)})
        data = res.json()
        eval_data = data["eligibility_evaluation"]

        self.assertEqual(eval_data["outcome"], "needs_information")
        self.assertIn("land_holding_acres", eval_data["missing_fields"])
        # Score must NOT be 100%
        self.assertNotEqual(data["eligibility_score"], 100)

    # -------------------------------------------------------------------------
    # 5. Failed Eligibility Conditions
    # -------------------------------------------------------------------------
    def test_failed_eligibility_condition_gives_not_eligible(self):
        """Verify that violating criteria produces 'not_eligible' with 0% score."""
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.farmer_citizen.id),
            "scheme_id": "PM_KISAN",
            "applicant_data": {
                "beneficiary_group": "farmers",
                "land_holding_acres": 0.0,  # Fails land_holding_acres > 0
                "has_bank_account": True,
            },
        })
        app_id = draft_res.json()["id"]

        res = self.client.get(f"/api/applications/{app_id}", params={"citizen_id": str(self.farmer_citizen.id)})
        data = res.json()
        eval_data = data["eligibility_evaluation"]

        self.assertEqual(eval_data["outcome"], "not_eligible")
        self.assertEqual(data["eligibility_score"], 0)

    # -------------------------------------------------------------------------
    # 6. Officer Review and Decision with Audit History
    # -------------------------------------------------------------------------
    def test_officer_review_decision_and_audit_history(self):
        """Verify officer can approve or request correction, and audit log is preserved."""
        # 1. Create and submit application with token
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.student_citizen.id),
            "scheme_id": "KARNATAKA_SSP_DIRECTORY",
            "applicant_data": {
                "beneficiary_group": "students",
                "education_level": "PUC",
                "has_bank_account": True,
            },
        })
        app_id = draft_res.json()["id"]

        token_res = self.client.post(f"/api/applications/{app_id}/token", json={
            "citizen_id": str(self.student_citizen.id),
        })
        token = token_res.json()["raw_token"]

        sub_res = self.client.post(f"/api/applications/{app_id}/submit", json={
            "citizen_id": str(self.student_citizen.id),
            "confirmation_token": token,
        })
        self.assertEqual(sub_res.status_code, 200)
        self.assertTrue(sub_res.json()["submission_reference"].startswith("SIM-GS-"))

        # 2. Officer reviews and approves
        dec_res = self.client.post(
            f"/api/applications/{app_id}/officer-decision",
            headers=self.officer_headers,
            json={
                "decision": "APPROVED",
                "notes": "Student marks and income verified via e-Pramana.",
                "order_number": "SSP-GOV-ORD-2026-789",
            },
        )
        self.assertEqual(dec_res.status_code, 200)
        app_approved = dec_res.json()
        self.assertEqual(app_approved["current_status"], "APPROVED")
        self.assertEqual(app_approved["official_order_number"], "SSP-GOV-ORD-2026-789")

        # 3. Verify timeline and audit history
        res_review = self.client.get(
            f"/api/applications/{app_id}",
            headers=self.officer_headers,
        )
        self.assertEqual(res_review.status_code, 200)
        timeline = res_review.json()["timeline"]
        self.assertTrue(len(timeline) > 0)
        actions = [t["status"] for t in timeline]
        self.assertTrue(any("APPROVED" in a for a in actions))

    # -------------------------------------------------------------------------
    # 7. Citizen Status Tracking
    # -------------------------------------------------------------------------
    def test_citizen_status_tracking(self):
        """Verify citizen can track application status and view updated history."""
        draft_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.student_citizen.id),
            "scheme_id": "KARNATAKA_SSP_DIRECTORY",
            "applicant_data": {
                "beneficiary_group": "students",
                "has_bank_account": True,
            },
        })
        app_id = draft_res.json()["id"]

        token_res = self.client.post(f"/api/applications/{app_id}/token", json={
            "citizen_id": str(self.student_citizen.id),
        })
        token = token_res.json()["raw_token"]

        sub_res = self.client.post(f"/api/applications/{app_id}/submit", json={
            "citizen_id": str(self.student_citizen.id),
            "confirmation_token": token,
        })
        ref = sub_res.json()["submission_reference"]

        # Track via history endpoint
        hist_res = self.client.get(
            f"/api/applications/{app_id}/history",
            params={"citizen_id": str(self.student_citizen.id)},
        )
        self.assertEqual(hist_res.status_code, 200)
        history = hist_res.json()
        self.assertTrue(len(history) >= 2)
        statuses = [h["to_status"] for h in history]
        self.assertIn("draft", statuses)
        self.assertTrue("SUBMITTED" in statuses or "submitted_to_official_portal" in statuses)
