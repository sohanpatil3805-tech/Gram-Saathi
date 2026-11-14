"""
Unit tests for cryptographically secure confirmation tokens.
Tests generation, hashing, single-use enforcement, 5-minute expiry, and replay prevention.
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
from backend.db.models import Citizen, Application, ConfirmationToken
from backend.services.token_service import TokenService, hash_token


class ConfirmationTokenTests(unittest.TestCase):
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

        # Create dummy citizen and application
        self.citizen = Citizen(phone_number="+919876543210")
        self.db.add(self.citizen)
        self.db.commit()

        self.app = Application(citizen_id=self.citizen.id, scheme_id="DEMO_SCHEME")
        self.db.add(self.app)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_token_generation_and_hashing(self):
        raw_token, record = TokenService.generate_token(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
        )
        self.assertTrue(raw_token.startswith("gs_confirm_"))
        self.assertEqual(record.token_hash, hash_token(raw_token))
        self.assertFalse(record.is_consumed)
        self.assertIsNone(record.consumed_at)

        # Check expiry is roughly 5 minutes in future
        now = datetime.now(timezone.utc)
        expires_at = record.expires_at.replace(tzinfo=timezone.utc) if record.expires_at.tzinfo is None else record.expires_at
        time_diff = (expires_at - now).total_seconds()
        self.assertGreater(time_diff, 280)
        self.assertLessEqual(time_diff, 305)

    def test_valid_token_consumption(self):
        raw_token, _ = TokenService.generate_token(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
        )
        is_valid, err, rec = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            raw_token=raw_token,
        )
        self.assertTrue(is_valid)
        self.assertIsNone(err)
        self.assertTrue(rec.is_consumed)
        self.assertIsNotNone(rec.consumed_at)

    def test_replay_attack_prevention_fails_single_use(self):
        raw_token, _ = TokenService.generate_token(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
        )
        # First use succeeds
        valid1, err1, _ = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            raw_token=raw_token,
        )
        self.assertTrue(valid1)

        # Second use (replay attack) MUST fail
        valid2, err2, _ = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            raw_token=raw_token,
        )
        self.assertFalse(valid2)
        self.assertEqual(err2, "TOKEN_ALREADY_CONSUMED")

    def test_expired_token_rejected(self):
        # Generate token with negative expiry (already expired)
        raw_token, record = TokenService.generate_token(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            expiry_minutes=-1,
        )
        is_valid, err, _ = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            raw_token=raw_token,
        )
        self.assertFalse(is_valid)
        self.assertEqual(err, "TOKEN_EXPIRED")

    def test_idor_mismatched_citizen_or_application_rejected(self):
        other_citizen = Citizen(phone_number="+919000000099")
        self.db.add(other_citizen)
        self.db.commit()

        raw_token, _ = TokenService.generate_token(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
        )

        # Try consuming with different citizen
        is_valid, err, _ = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=other_citizen.id,
            application_id=self.app.id,
            raw_token=raw_token,
        )
        self.assertFalse(is_valid)
        self.assertEqual(err, "TOKEN_MISMATCH")

    def test_unknown_or_empty_token_rejected(self):
        is_valid, err, _ = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            raw_token="gs_confirm_invalid_does_not_exist",
        )
        self.assertFalse(is_valid)
        self.assertEqual(err, "TOKEN_NOT_FOUND")

        is_valid_empty, err_empty, _ = TokenService.validate_and_consume(
            db=self.db,
            citizen_id=self.citizen.id,
            application_id=self.app.id,
            raw_token="   ",
        )
        self.assertFalse(is_valid_empty)
        self.assertEqual(err_empty, "TOKEN_EMPTY")


if __name__ == "__main__":
    unittest.main()
