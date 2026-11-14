"""
Integration tests for persistent conversation sessions and message history API endpoints.
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
from backend.db.models import Citizen
from backend.main import create_app
from backend.schemes.repository import SchemeRepository


class ConversationApiTests(unittest.TestCase):
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

        # Seed citizen
        db = self.TestingSessionLocal()
        self.citizen = Citizen(phone_number="+919876543210", preferred_language="kn")
        self.other_citizen = Citizen(phone_number="+919999999999", preferred_language="hi")
        db.add_all([self.citizen, self.other_citizen])
        db.commit()
        db.refresh(self.citizen)
        db.refresh(self.other_citizen)
        db.close()

    def tearDown(self):
        self.app.dependency_overrides.clear()
        self.engine.dispose()

    def test_create_and_resume_session(self):
        # 1. Create new session for citizen
        res1 = self.client.post("/api/conversations", json={
            "citizen_id": str(self.citizen.id),
            "language": "kn",
            "channel": "whatsapp",
        })
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        session_id = data1["id"]
        token = data1["session_token"]
        self.assertEqual(data1["language"], "kn")
        self.assertEqual(data1["channel"], "whatsapp")

        # 2. Reconnect / resume using citizen_id (simulating returning after days)
        res2 = self.client.post("/api/conversations", json={
            "citizen_id": str(self.citizen.id),
            "language": "kn",
        })
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        # Same persistent session recovered
        self.assertEqual(data2["id"], session_id)
        self.assertEqual(data2["session_token"], token)

    def test_send_and_retrieve_messages(self):
        # Create session
        res = self.client.post("/api/conversations", json={"language": "en"})
        session_id = res.json()["id"]
        token = res.json()["session_token"]

        # Send message 1
        msg_res1 = self.client.post(f"/api/conversations/{session_id}/messages", json={
            "content": "What schemes are available for small farmers?",
            "sender": "citizen",
            "session_token": token,
        })
        self.assertEqual(msg_res1.status_code, 201)
        self.assertEqual(msg_res1.json()["content"], "What schemes are available for small farmers?")

        # Send message 2 (assistant reply)
        msg_res2 = self.client.post(f"/api/conversations/{session_id}/messages", json={
            "content": "PM-KISAN provides income support of Rs 6,000 per year.",
            "sender": "assistant",
            "session_token": token,
        })
        self.assertEqual(msg_res2.status_code, 201)

        # Retrieve history
        hist_res = self.client.get(f"/api/conversations/{session_id}/history", params={"session_token": token})
        self.assertEqual(hist_res.status_code, 200)
        history = hist_res.json()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["sender"], "citizen")
        self.assertEqual(history[1]["sender"], "assistant")

    def test_reject_sensitive_chat_content(self):
        res = self.client.post("/api/conversations", json={"language": "en"})
        session_id = res.json()["id"]
        token = res.json()["session_token"]

        # Attempt to send OTP
        otp_res = self.client.post(f"/api/conversations/{session_id}/messages", json={
            "content": "My secret OTP is 482910",
            "session_token": token,
        })
        self.assertEqual(otp_res.status_code, 422)

        # Attempt to send 12-digit Aadhaar
        aadhaar_res = self.client.post(f"/api/conversations/{session_id}/messages", json={
            "content": "Here is my number 123456789012",
            "session_token": token,
        })
        self.assertEqual(aadhaar_res.status_code, 422)

    def test_idor_protection_other_citizen_denied(self):
        # Create session owned by self.citizen
        res = self.client.post("/api/conversations", json={
            "citizen_id": str(self.citizen.id),
        })
        session_id = res.json()["id"]

        # Other citizen attempts to access history
        denied_res = self.client.get(
            f"/api/conversations/{session_id}/history",
            params={"citizen_id": str(self.other_citizen.id)},
        )
        self.assertEqual(denied_res.status_code, 403)


if __name__ == "__main__":
    unittest.main()
