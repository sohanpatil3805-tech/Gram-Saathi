"""
Unit tests for all 11 SQLAlchemy database models in Gram Saathi.
Runs in an isolated temporary SQLite database.
"""
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.models import (
    Citizen,
    CitizenProfile,
    ConversationSession,
    ConversationMessage,
    Application,
    ApplicationStatusHistory,
    UploadedDocument,
    Officer,
    RolePermission,
    AuditLog,
    ConfirmationToken,
)


class DatabaseModelsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_citizen_and_profile_models(self):
        citizen = Citizen(
            phone_number="+919876543210",
            name="Ramu Nayak",
            preferred_language="kn",
            citizen_group="farmer",
            state="Karnataka",
            district="Mandya",
            village="Shivalli",
            aadhaar_ref="XXXX-XXXX-1234",
        )
        self.db.add(citizen)
        self.db.commit()
        self.db.refresh(citizen)

        self.assertIsInstance(citizen.id, uuid.UUID)
        self.assertEqual(citizen.phone_number, "+919876543210")
        self.assertEqual(citizen.preferred_language, "kn")
        self.assertFalse(citizen.is_deleted)

        profile = CitizenProfile(
            citizen_id=citizen.id,
            annual_income=120000,
            land_holding_acres=2.5,
            caste_category="OBC",
            is_bpl=True,
            has_bank_account=True,
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)

        self.assertEqual(profile.citizen_id, citizen.id)
        self.assertEqual(float(profile.land_holding_acres), 2.5)
        self.assertTrue(profile.has_bank_account)
        self.assertEqual(citizen.profile.annual_income, 120000)

    def test_conversation_session_and_messages(self):
        citizen = Citizen(phone_number="+919988776655", preferred_language="hi")
        self.db.add(citizen)
        self.db.commit()

        session = ConversationSession(
            citizen_id=citizen.id,
            session_token="session_test_token_123",
            phone_number="+919988776655",
            channel="whatsapp",
            language="hi",
            current_stage="DISCOVERY",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        msg1 = ConversationMessage(
            session_id=session.id,
            sender="citizen",
            content="मुझे छात्रवृत्ति के बारे में जानना है",
            content_type="text",
        )
        msg2 = ConversationMessage(
            session_id=session.id,
            sender="assistant",
            content="विद्यार्थियों के लिए उपलब्ध योजनाएँ...",
            content_type="text",
        )
        self.db.add_all([msg1, msg2])
        self.db.commit()

        self.assertEqual(len(session.messages), 2)
        self.assertEqual(session.messages[0].sender, "citizen")
        self.assertEqual(session.messages[1].sender, "assistant")

    def test_application_and_history_models(self):
        citizen = Citizen(phone_number="+919123456789")
        self.db.add(citizen)
        self.db.commit()

        app = Application(
            citizen_id=citizen.id,
            scheme_id="PM_KISAN",
            current_status="draft",
            progress_percentage=25,
            applicant_data={"acres": 3.0},
            is_simulated=True,
        )
        self.db.add(app)
        self.db.commit()
        self.db.refresh(app)

        hist = ApplicationStatusHistory(
            application_id=app.id,
            from_status=None,
            to_status="draft",
            remarks="Initial draft created",
            changed_by="citizen",
        )
        self.db.add(hist)
        self.db.commit()

        self.assertEqual(len(app.status_history), 1)
        self.assertEqual(app.status_history[0].to_status, "draft")
        self.assertTrue(app.is_simulated)

    def test_uploaded_document_model(self):
        citizen = Citizen(phone_number="+919000000001")
        self.db.add(citizen)
        self.db.commit()

        doc = UploadedDocument(
            citizen_id=citizen.id,
            document_type="land_records_rtc",
            original_filename="rtc_record.pdf",
            stored_filename="rtc_uuid_123.pdf",
            file_path="storage/documents/rtc_uuid_123.pdf",
            file_size_bytes=10240,
            mime_type="application/pdf",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            ocr_status="completed",
            ocr_extracted_fields={"survey_no": "124/2"},
            validation_status="valid",
            is_verified=True,
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)

        self.assertEqual(doc.document_type, "land_records_rtc")
        self.assertTrue(doc.is_verified)
        self.assertEqual(doc.ocr_extracted_fields["survey_no"], "124/2")

    def test_officer_and_role_permission_models(self):
        officer = Officer(
            username="officer_mandya_01",
            hashed_password="pbkdf2_sha256$mockhash",
            full_name="Anand Kumar",
            role="panchayat_officer",
            jurisdiction_district="Mandya",
            jurisdiction_village="Shivalli",
        )
        perm = RolePermission(
            role="panchayat_officer",
            permission="application:review",
            description="Review local panchayat applications",
        )
        self.db.add_all([officer, perm])
        self.db.commit()

        self.assertEqual(officer.role, "panchayat_officer")
        self.assertTrue(officer.is_active)
        self.assertEqual(perm.permission, "application:review")

    def test_audit_log_and_confirmation_token_models(self):
        citizen = Citizen(phone_number="+919000000002")
        self.db.add(citizen)
        self.db.commit()

        app = Application(citizen_id=citizen.id, scheme_id="NSP_SCHOLARSHIP")
        self.db.add(app)
        self.db.commit()

        log = AuditLog(
            action="APPLICATION_DRAFT_CREATED",
            actor_type="citizen",
            actor_id=citizen.id,
            target_entity="application",
            target_id=app.id,
            details={"scheme": "NSP_SCHOLARSHIP"},
        )
        token = ConfirmationToken(
            citizen_id=citizen.id,
            application_id=app.id,
            token_hash="a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            is_consumed=False,
        )
        self.db.add_all([log, token])
        self.db.commit()

        self.assertEqual(log.action, "APPLICATION_DRAFT_CREATED")
        self.assertFalse(token.is_consumed)


if __name__ == "__main__":
    unittest.main()
