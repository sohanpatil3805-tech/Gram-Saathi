"""
Rate limiting middleware and utilities for Gram Saathi.
Implements per-IP rate limiting (10 requests per minute for OTP endpoints).
Uses slowapi when available, with an in-memory sliding window counter fallback.
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter: Optional[Limiter] = Limiter(key_func=get_remote_address, default_limits=["10/minute"])
except ImportError:
    limiter = None
    RateLimitExceeded = Exception  # type: ignore


class InMemoryRateLimiter:
    """In-memory sliding window rate limiter per client IP."""
    def __init__(self, requests_per_minute: int = 10):
        self.requests_per_minute = requests_per_minute
        self.records: Dict[str, List[float]] = defaultdict(list)

    def check(self, request: Request, client_ip: Optional[str] = None) -> None:
        ip = client_ip or (request.client.host if request.client else "127.0.0.1")
        now = time.time()
        window_start = now - 60.0
        # Discard timestamps outside current 60-second window
        self.records[ip] = [t for t in self.records[ip] if t > window_start]
        if len(self.records[ip]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: maximum {self.requests_per_minute} requests per minute.",
            )
        self.records[ip].append(now)

    def reset(self) -> None:
        """Reset rate limiter state (useful in testing)."""
        self.records.clear()


otp_rate_limiter = InMemoryRateLimiter(requests_per_minute=10)
