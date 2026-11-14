"""
Unit & integration tests for Citizen Registration and Lookup API endpoints.
Tests phone-based onboarding, Aadhaar masking, language preference, and profile initialization.
"""
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.session import get_db
from backend.main import create_app


class CitizenApiTests(unittest.TestCase):
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

    def tearDown(self):
        self.app.dependency_overrides.clear()
        self.engine.dispose()

    def test_register_new_citizen_success(self):
        res = self.client.post("/api/citizens", json={
            "phone_number": "+919876543210",
            "name": "Ramu Nayak",
            "preferred_language": "kn",
            "citizen_group": "farmer",
            "state": "Karnataka",
            "district": "Mandya",
            "village": "Shivalli",
            "aadhaar_masked": "XXXX-XXXX-1234",
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("id", data)
        self.assertEqual(data["phone_number"], "+919876543210")
        self.assertEqual(data["preferred_language"], "kn")
        self.assertEqual(data["aadhaar_ref"], "XXXX-XXXX-1234")

    def test_register_existing_citizen_updates_fields(self):
        # First registration
        res1 = self.client.post("/api/citizens", json={
            "phone_number": "+919123456789",
            "name": "Priya Sharma",
            "preferred_language": "hi",
        })
        self.assertEqual(res1.status_code, 201)
        citizen_id = res1.json()["id"]

        # Subsequent call with updated details
        res2 = self.client.post("/api/citizens", json={
            "phone_number": "+919123456789",
            "name": "Priya Sharma",
            "preferred_language": "hi",
            "district": "Bengaluru Urban",
        })
        self.assertEqual(res2.status_code, 201)
        data2 = res2.json()
        self.assertEqual(data2["id"], citizen_id)
        self.assertEqual(data2["district"], "Bengaluru Urban")

    def test_reject_full_plaintext_aadhaar(self):
        # Sending 12-digit plaintext Aadhaar must be rejected
        res = self.client.post("/api/citizens", json={
            "phone_number": "+919876543210",
            "aadhaar_masked": "123456789012",
        })
        self.assertEqual(res.status_code, 422)

    def test_reject_invalid_phone_number(self):
        res = self.client.post("/api/citizens", json={
            "phone_number": "not_a_phone",
        })
        self.assertEqual(res.status_code, 422)

    def test_get_citizen_lookup(self):
        reg = self.client.post("/api/citizens", json={
            "phone_number": "+919555555555",
            "name": "Anand",
        })
        citizen_id = reg.json()["id"]

        get_res = self.client.get(f"/api/citizens/{citizen_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["name"], "Anand")

    def test_get_nonexistent_citizen_returns_404(self):
        res = self.client.get("/api/citizens/00000000-0000-0000-0000-000000000000")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
