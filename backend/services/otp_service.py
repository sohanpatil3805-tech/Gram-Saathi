"""
OTP Service for Gram Saathi citizen authentication.
Generates, stores, and verifies 6-digit OTPs with 5-minute expiry.
In DEV mode (DEMO_MODE=True or OTP_DEV_MODE=True): logs OTP to console clearly.
In PROD mode: stubs SMS sending (no gateway integrated yet).
Never exposes OTP in HTTP response body (except dev-only endpoints flagged explicitly).
Max 3 OTP attempts per phone per 5 minutes.
"""
from __future__ import annotations

import logging
import random
import string
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, Optional

from backend.config import settings

logger = logging.getLogger(__name__)

# OTP_DEV_MODE override — read directly from env at module load time
# (pydantic settings are cached; fall back gracefully if key not in model)
def _is_dev_mode() -> bool:
    if settings.demo_mode:
        return True
    # Allow explicit OTP_DEV_MODE env var even if not in model
    import os
    return os.environ.get("OTP_DEV_MODE", "").lower() in ("1", "true", "yes")


# ─── In-memory OTP store ─────────────────────────────────────────────────────
# Structure: { phone: {"otp": str, "expires_at": datetime, "attempts": int} }
_otp_store: Dict[str, dict] = {}
_store_lock: Lock = Lock()

OTP_EXPIRY_MINUTES = 5
MAX_ATTEMPTS = 3


def _cleanup_expired() -> None:
    """Remove expired OTP records (called on each access — cheap for low cardinality)."""
    now = datetime.now(timezone.utc)
    expired = [phone for phone, record in _otp_store.items() if record["expires_at"] <= now]
    for phone in expired:
        del _otp_store[phone]


def generate_otp(phone: str) -> str:
    """
    Generate a 6-digit OTP for the given phone number.
    Stores it in memory with 5-minute expiry.
    Logs OTP to console in DEV mode; stubs SMS in PROD.
    Returns the generated OTP string.
    """
    otp = "".join(random.choices(string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    with _store_lock:
        _cleanup_expired()
        _otp_store[phone] = {
            "otp": otp,
            "expires_at": expires_at,
            "attempts": 0,
        }

    if _is_dev_mode():
        # DEV: log to console clearly — NEVER in HTTP response body
        logger.info("[DEV OTP] Phone: %s  OTP: %s  (expires in %d min)", phone, otp, OTP_EXPIRY_MINUTES)
        print(f"[DEV OTP] Phone: {phone}  OTP: {otp}  (expires in {OTP_EXPIRY_MINUTES} min)", flush=True)
    else:
        # PROD stub — no SMS gateway integrated yet
        logger.info("[OTP] SMS would be sent to %s (SMS gateway not configured — PROD stub)", phone)

    return otp


def verify_otp(phone: str, otp: str) -> bool:
    """
    Verify the OTP for the given phone number.
    Consumes (deletes) the OTP on success.
    Increments attempt counter; raises ValueError if max attempts exceeded.
    Returns True if valid, False if invalid/expired.
    """
    with _store_lock:
        _cleanup_expired()
        record = _otp_store.get(phone)

        if record is None:
            logger.warning("[OTP] No active OTP found for %s", phone)
            return False

        # Check attempt limit
        if record["attempts"] >= MAX_ATTEMPTS:
            logger.warning("[OTP] Max attempts exceeded for %s", phone)
            del _otp_store[phone]
            raise ValueError(f"Maximum OTP attempts ({MAX_ATTEMPTS}) exceeded. Please request a new OTP.")

        # Check expiry (belt-and-suspenders; _cleanup_expired should have caught this)
        if record["expires_at"] <= datetime.now(timezone.utc):
            del _otp_store[phone]
            logger.warning("[OTP] Expired OTP presented for %s", phone)
            return False

        # Increment attempt count before checking so a timing attack doesn't bypass it
        record["attempts"] += 1

        if record["otp"] == otp:
            del _otp_store[phone]
            logger.info("[OTP] Verified successfully for %s", phone)
            return True

        logger.warning("[OTP] Invalid OTP attempt %d/%d for %s", record["attempts"], MAX_ATTEMPTS, phone)
        return False


def get_remaining_attempts(phone: str) -> Optional[int]:
    """Return remaining OTP attempts for a phone, or None if no active OTP."""
    with _store_lock:
        record = _otp_store.get(phone)
        if record is None:
            return None
        if record["expires_at"] <= datetime.now(timezone.utc):
            return None
        return MAX_ATTEMPTS - record["attempts"]


def has_active_otp(phone: str) -> bool:
    """Return True if there is a non-expired OTP for this phone."""
    with _store_lock:
        _cleanup_expired()
        return phone in _otp_store
