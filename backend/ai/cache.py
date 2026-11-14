"""
Gram Saathi — Scheme Guidance Cache
In-memory TTL cache for public, non-personal scheme guidance.
Avoids unnecessary repetitive Gemini API calls for identical general citizen inquiries.
Strictly excludes any requests containing personal, financial, or sensitive data.
"""
from __future__ import annotations

import hashlib
import re
import time
from typing import Optional, Dict, Tuple


# Regex patterns that indicate personal, financial, or specific user data
PERSONAL_PATTERNS = [
    re.compile(r"\b\d{10,12}\b"),  # 10-12 digit numbers (phone, aadhaar)
    re.compile(r"\b\d{5,}\b"),     # 5+ digit numbers (incomes, account numbers)
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), # email
    re.compile(r"\b(?:my name is|i am|income is|earning|acres|khata|survey|my salary|i earn)\b", re.IGNORECASE),
]


def is_cacheable_prompt(message: str) -> bool:
    """Return True if prompt is general public inquiry without personal data."""
    if not message or len(message.strip()) < 5:
        return False
    text = message.strip()
    for pat in PERSONAL_PATTERNS:
        if pat.search(text):
            return False
    return True


class SchemeGuidanceCache:
    """Bounded cache with time-to-live (TTL) expiration for public scheme answers."""

    def __init__(self, ttl_seconds: int = 3600, max_entries: int = 256) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._cache: Dict[str, Tuple[str, float]] = {}

    def _make_key(self, language: str, beneficiary_group: str, state: str, query: str) -> str:
        normalized = " ".join(query.strip().lower().split())
        raw = f"{language}|{beneficiary_group.lower().strip()}|{state.lower().strip()}|{normalized}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, language: str, beneficiary_group: str, state: str, query: str) -> Optional[str]:
        """Retrieve cached guidance if present and unexpired."""
        if not is_cacheable_prompt(query):
            return None
        key = self._make_key(language, beneficiary_group, state, query)
        entry = self._cache.get(key)
        if entry is None:
            return None
        value, timestamp = entry
        if time.time() - timestamp > self.ttl_seconds:
            self._cache.pop(key, None)
            return None
        return value

    def set(self, language: str, beneficiary_group: str, state: str, query: str, response: str) -> None:
        """Cache response for non-personal public queries."""
        if not is_cacheable_prompt(query) or not response:
            return
        if len(self._cache) >= self.max_entries:
            # Evict oldest entry
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
            self._cache.pop(oldest_key, None)
        key = self._make_key(language, beneficiary_group, state, query)
        self._cache[key] = (response, time.time())

    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)


# Global singleton cache instance
guidance_cache = SchemeGuidanceCache()
