"""
Notification service for Gram Saathi.
Implements citizen notification stubs for status changes and reminders.
In MVP / dev mode, outputs structured logs to console.
"""
from __future__ import annotations

import logging
from typing import Optional

from backend.config import settings

logger = logging.getLogger(__name__)


def notify_status_change(
    citizen_id: str,
    application_id: str,
    new_status: str,
    language: str = "en",
) -> None:
    """
    Notify citizen about application status transition.
    In dev/demo mode: prints to console and writes to logger.
    WhatsApp delivery is out of scope / stubbed.
    """
    message = f"[NOTIFICATION] Citizen {citizen_id}: Application {application_id} status → {new_status}"
    print(message)
    logger.info(message)
