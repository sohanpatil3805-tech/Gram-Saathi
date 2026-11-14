"""
Integration tests for application draft management, state transitions,
confirmation token submission, and officer decisions.
"""
import tempfile
import unittest
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.session import get_db
from backend.db.models import Citizen, Officer
from backend.main import create_app


class ApplicationApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )
        Base.metadata.create_all(bind=self.engine)
        self.TestingSessionLocal = sessionmaker(bind=self.engine)

        def override_get_db():
            db = self.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app = create_app()
        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

        # Seed citizen and officer
        db = self.TestingSessionLocal()
        self.citizen = Citizen(phone_number="+919876543210", preferred_language="kn", district="Mandya")
        self.other_citizen = Citizen(phone_number="+919999999999", preferred_language="hi")
        self.officer = Officer(
            username="tehsil_officer_01",
            hashed_password="mock",
            full_name="Tehsil Officer",
            role="tehsil_officer",
            jurisdiction_district="Mandya",
        )
        db.add_all([self.citizen, self.other_citizen, self.officer])
        db.commit()
        db.refresh(self.citizen)
        db.refresh(self.other_citizen)
        db.refresh(self.officer)
        db.close()

    def tearDown(self):
        self.app.dependency_overrides.clear()
        self.engine.dispose()

    def test_full_application_lifecycle_with_token_and_decision(self):
        # 1. Create application draft
        create_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.citizen.id),
            "scheme_id": "PM_KISAN",
            "applicant_data": {"land_holding_acres": 2.0},
        })
        self.assertEqual(create_res.status_code, 201)
        app_data = create_res.json()
        app_id = app_data["id"]
        self.assertEqual(app_data["current_status"], "draft")
        self.assertTrue(app_data["is_simulated"])

        # 2. Update draft fields
        patch_res = self.client.patch(f"/api/applications/drafts/{app_id}", json={
            "citizen_id": str(self.citizen.id),
            "applicant_data": {"land_holding_acres": 2.5, "crop_type": "Paddy"},
        })
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["applicant_data"]["crop_type"], "Paddy")

        # 3. Request 5-minute confirmation token
        token_res = self.client.post(f"/api/applications/{app_id}/token", json={
            "citizen_id": str(self.citizen.id),
        })
        self.assertEqual(token_res.status_code, 200)
        raw_token = token_res.json()["raw_token"]
        self.assertTrue(raw_token.startswith("gs_confirm_"))
        self.assertEqual(token_res.json()["expiry_minutes"], 5)

        # 4. Attempt submission with invalid token -> fails
        invalid_sub = self.client.post(f"/api/applications/{app_id}/submit", json={
            "citizen_id": str(self.citizen.id),
            "confirmation_token": "gs_confirm_invalid_token_12345",
        })
        self.assertEqual(invalid_sub.status_code, 400)

        # 5. Submit with valid confirmation token -> succeeds
        submit_res = self.client.post(f"/api/applications/{app_id}/submit", json={
            "citizen_id": str(self.citizen.id),
            "confirmation_token": raw_token,
        })
        self.assertEqual(submit_res.status_code, 200)
        submitted = submit_res.json()
        self.assertEqual(submitted["current_status"], "submitted_to_official_portal")
        self.assertTrue(submitted["submission_reference"].startswith("SIM-GS-"))
        self.assertIsNotNone(submitted["submitted_at"])

        # 6. Replay attack: submitting with used token fails
        replay_sub = self.client.post(f"/api/applications/{app_id}/submit", json={
            "citizen_id": str(self.citizen.id),
            "confirmation_token": raw_token,
        })
        self.assertEqual(replay_sub.status_code, 400)

        # 7. Officer reviews and approves
        decision_res = self.client.post(f"/api/applications/{app_id}/decision", json={
            "officer_id": str(self.officer.id),
            "decision": "approved",
            "remarks": "Land records verified via RTC.",
            "official_order_number": "ORD-KA-2026-9812",
        })
        self.assertEqual(decision_res.status_code, 200)
        approved = decision_res.json()
        self.assertEqual(approved["current_status"], "approved")
        self.assertEqual(approved["official_order_number"], "ORD-KA-2026-9812")

        # 8. Check audit history has full sequence
        hist_res = self.client.get(f"/api/applications/{app_id}/history", params={"citizen_id": str(self.citizen.id)})
        self.assertEqual(hist_res.status_code, 200)
        history = hist_res.json()
        statuses = [h["to_status"] for h in history]
        self.assertIn("draft", statuses)
        self.assertIn("ready_for_review", statuses)
        self.assertIn("submitted_to_official_portal", statuses)
        self.assertIn("approved", statuses)

    def test_idor_protection_other_citizen_denied_access(self):
        # Create draft for self.citizen
        create_res = self.client.post("/api/applications/drafts", json={
            "citizen_id": str(self.citizen.id),
            "scheme_id": "PM_KISAN",
        })
        app_id = create_res.json()["id"]

        # Other citizen attempts to access draft
        denied_get = self.client.get(f"/api/applications/drafts/{app_id}", params={"citizen_id": str(self.other_citizen.id)})
        self.assertEqual(denied_get.status_code, 403)

        # Other citizen attempts to update draft
        denied_patch = self.client.patch(f"/api/applications/drafts/{app_id}", json={
            "citizen_id": str(self.other_citizen.id),
            "applicant_data": {"hacked": True},
        })
        self.assertEqual(denied_patch.status_code, 403)


if __name__ == "__main__":
    unittest.main()
