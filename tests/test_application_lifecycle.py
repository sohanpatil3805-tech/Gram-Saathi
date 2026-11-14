"""
Integration tests for the complete application lifecycle, state transitions,
confirmation token enforcement, officer decision RBAC, IDOR security, and timeline tracking.
"""
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.session import get_db
from backend.db.models import Citizen, Officer, Application, UploadedDocument
from backend.main import create_app
from backend.auth.security import create_access_token
from backend.services.token_service import (
    create_confirmation_token,
    validate_and_consume_token,
)
from backend.services.storage_service import StorageService


class ApplicationLifecycleTests(unittest.TestCase):
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

        # Seed citizens and officer
        db = self.TestingSessionLocal()
        self.citizen_a = Citizen(
            phone_number="+919876543210",
            name="Ramu Nayak",
            preferred_language="kn",
            district="Mandya",
        )
        self.citizen_b = Citizen(
            phone_number="+919876543211",
            name="Priya Sharma",
            preferred_language="hi",
            district="Bangalore Rural",
        )
        self.officer = Officer(
            username="tehsil_officer_ka",
            hashed_password="mock",
            full_name="Tehsil Officer Mandya",
            role="tehsil_officer",
            jurisdiction_district="Mandya",
        )
        db.add_all([self.citizen_a, self.citizen_b, self.officer])
        db.commit()
        db.refresh(self.citizen_a)
        db.refresh(self.citizen_b)
        db.refresh(self.officer)

        # Generate tokens
        self.token_citizen_a = create_access_token({
            "sub": str(self.citizen_a.id),
            "phone": self.citizen_a.phone_number,
            "type": "citizen",
        })
        self.token_citizen_b = create_access_token({
            "sub": str(self.citizen_b.id),
            "phone": self.citizen_b.phone_number,
            "type": "citizen",
        })
        self.token_officer = create_access_token({
            "sub": str(self.officer.id),
            "username": self.officer.username,
            "role": self.officer.role,
            "type": "officer",
        })
        db.close()

    def tearDown(self):
        self.app.dependency_overrides.clear()
        self.engine.dispose()

    def test_full_lifecycle_create_submit_approve_timeline(self):
        """Test complete workflow: DRAFT -> SUBMITTED (with token) -> APPROVED -> timeline."""
        # 1. Citizen A creates application draft
        create_res = self.client.post(
            "/api/applications/drafts",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
            json={
                "citizen_id": str(self.citizen_a.id),
                "scheme_id": "PM_KISAN",
                "applicant_data": {"land_holding_acres": 2.0},
            },
        )
        self.assertEqual(create_res.status_code, 201)
        app_id = create_res.json()["id"]
        self.assertEqual(create_res.json()["current_status"], "draft")

        # 2. Create confirmation token for application
        db = self.TestingSessionLocal()
        raw_token = create_confirmation_token(application_id=app_id, citizen_id=str(self.citizen_a.id), db=db)
        db.close()
        self.assertTrue(raw_token.startswith("gs_confirm_"))

        # 3. Citizen A submits application with confirmation token
        submit_res = self.client.post(
            f"/api/applications/{app_id}/submit",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
            json={
                "confirmation_token": raw_token,
            },
        )
        self.assertEqual(submit_res.status_code, 200)
        submitted_app = submit_res.json()
        self.assertEqual(submitted_app["current_status"], "SUBMITTED")
        self.assertTrue(submitted_app["submission_reference"].startswith("SIM-GS-"))

        # 4. Officer approves application via /officer-decision
        with patch("backend.api.applications.notify_status_change") as mock_notify:
            decision_res = self.client.post(
                f"/api/applications/{app_id}/officer-decision",
                headers={"Authorization": f"Bearer {self.token_officer}"},
                json={
                    "decision": "APPROVED",
                    "notes": "RTC and land records verified in Mandya.",
                    "order_number": "ORD-KA-2026-MANDYA-001",
                },
            )
            self.assertEqual(decision_res.status_code, 200)
            approved_app = decision_res.json()
            self.assertEqual(approved_app["current_status"], "APPROVED")
            self.assertEqual(approved_app["official_order_number"], "ORD-KA-2026-MANDYA-001")

            # Verify notification stub was called
            mock_notify.assert_called_once()
            call_kwargs = mock_notify.call_args.kwargs
            self.assertEqual(call_kwargs["citizen_id"], str(self.citizen_a.id))
            self.assertEqual(call_kwargs["application_id"], str(app_id))
            self.assertEqual(call_kwargs["new_status"], "APPROVED")
            self.assertEqual(call_kwargs["language"], "kn")

        # 5. Check timeline endpoint
        timeline_res = self.client.get(
            f"/api/applications/{app_id}/timeline",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
        )
        self.assertEqual(timeline_res.status_code, 200)
        timeline = timeline_res.json()
        self.assertGreaterEqual(len(timeline), 2)
        statuses = [item["status"] for item in timeline]
        self.assertTrue(any("SUBMITTED" in s for s in statuses))
        self.assertTrue(any("APPROVED" in s for s in statuses))

    def test_idor_protection_citizen_b_cannot_get_citizen_a_application(self):
        """Verify Citizen B cannot read Citizen A's application."""
        # Citizen A creates application
        create_res = self.client.post(
            "/api/applications/drafts",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
            json={
                "citizen_id": str(self.citizen_a.id),
                "scheme_id": "PM_KISAN",
                "applicant_data": {"secret_note": "A's confidential info"},
            },
        )
        app_id = create_res.json()["id"]

        # Citizen A can read their own application
        get_a_res = self.client.get(
            f"/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
        )
        self.assertEqual(get_a_res.status_code, 200)
        self.assertEqual(get_a_res.json()["id"], app_id)

        # Citizen B attempts to read Citizen A's application -> 403 Forbidden
        get_b_res = self.client.get(
            f"/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {self.token_citizen_b}"},
        )
        self.assertEqual(get_b_res.status_code, 403)

        # Citizen B listing applications does NOT see Citizen A's application
        list_b_res = self.client.get(
            "/api/applications",
            headers={"Authorization": f"Bearer {self.token_citizen_b}"},
        )
        self.assertEqual(list_b_res.status_code, 200)
        app_ids_b = [a["id"] for a in list_b_res.json()]
        self.assertNotIn(app_id, app_ids_b)

        # Officer can read Citizen A's application
        get_off_res = self.client.get(
            f"/api/applications/{app_id}",
            headers={"Authorization": f"Bearer {self.token_officer}"},
        )
        self.assertEqual(get_off_res.status_code, 200)

    def test_officer_decision_requires_officer_jwt(self):
        """Verify that officer-decision strictly enforces Officer JWT authorization."""
        # Create draft application
        create_res = self.client.post(
            "/api/applications/drafts",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
            json={
                "citizen_id": str(self.citizen_a.id),
                "scheme_id": "PM_KISAN",
            },
        )
        app_id = create_res.json()["id"]

        # 1. No token -> 401 Unauthorized
        no_auth_res = self.client.post(
            f"/api/applications/{app_id}/officer-decision",
            json={
                "decision": "APPROVED",
                "notes": "Unauthorized attempt",
            },
        )
        self.assertEqual(no_auth_res.status_code, 401)

        # 2. Citizen token -> 403 Forbidden
        citizen_auth_res = self.client.post(
            f"/api/applications/{app_id}/officer-decision",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
            json={
                "decision": "APPROVED",
                "notes": "Citizen trying to self-approve",
            },
        )
        self.assertEqual(citizen_auth_res.status_code, 403)

        # 3. Officer token -> 200 OK
        db = self.TestingSessionLocal()
        raw_token = create_confirmation_token(application_id=app_id, citizen_id=str(self.citizen_a.id), db=db)
        db.close()

        # Submit first so it can be approved
        self.client.post(
            f"/api/applications/{app_id}/submit",
            headers={"Authorization": f"Bearer {self.token_citizen_a}"},
            json={"confirmation_token": raw_token},
        )

        valid_officer_res = self.client.post(
            f"/api/applications/{app_id}/officer-decision",
            headers={"Authorization": f"Bearer {self.token_officer}"},
            json={
                "decision": "APPROVED",
                "notes": "Authorized officer approved",
            },
        )
        self.assertEqual(valid_officer_res.status_code, 200)
        self.assertEqual(valid_officer_res.json()["current_status"], "APPROVED")

    def test_token_service_consume_and_replay_prevention(self):
        """Verify token service generation, single-use validation, and replay prevention."""
        db = self.TestingSessionLocal()
        app = Application(citizen_id=self.citizen_a.id, scheme_id="PM_KISAN")
        db.add(app)
        db.commit()
        db.refresh(app)

        raw_token = create_confirmation_token(application_id=app.id, citizen_id=self.citizen_a.id, db=db)
        self.assertTrue(raw_token.startswith("gs_confirm_"))

        # Valid consume succeeds
        is_valid = validate_and_consume_token(token=raw_token, application_id=app.id, db=db)
        self.assertTrue(is_valid)

        # Replay attack fails
        is_replay_valid = validate_and_consume_token(token=raw_token, application_id=app.id, db=db)
        self.assertFalse(is_replay_valid)

        db.close()


if __name__ == "__main__":
    unittest.main()
