"""
Gram Saathi — Concurrency & Request Coalescing Guard
Prevents duplicate concurrent chatbot requests (SingleFlight pattern).
When multiple identical requests arrive simultaneously while one is already in-flight,
subsequent requests wait for the in-flight operation rather than firing duplicate Gemini API calls.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Any, Callable, Coroutine, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class RequestCoalescer:
    """Coalesces identical concurrent async operations into a single execution."""

    def __init__(self) -> None:
        self._in_flight: Dict[str, asyncio.Future] = {}
        self._lock = asyncio.Lock()

    def _make_key(self, language: str, beneficiary_group: Optional[str], state: str, message: str) -> str:
        norm_msg = " ".join(message.strip().lower().split())
        raw = f"{language}|{str(beneficiary_group).lower().strip()}|{state.lower().strip()}|{norm_msg}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def execute_or_join(
        self,
        language: str,
        beneficiary_group: Optional[str],
        state: str,
        message: str,
        work_fn: Callable[[], Coroutine[Any, Any, Any]],
    ) -> Tuple[Any, bool]:
        """
        Execute work_fn if no identical request is currently in-flight.
        If an identical request is already running, await and join its result.
        Returns: (result, was_coalesced_boolean)
        """
        key = self._make_key(language, beneficiary_group, state, message)

        async with self._lock:
            if key in self._in_flight:
                logger.info("Coalescing duplicate concurrent chatbot request (key=%s)", key[:8])
                future = self._in_flight[key]
                is_leader = False
            else:
                loop = asyncio.get_running_loop()
                future = loop.create_future()
                # Attach silent error handler to prevent 'Future exception was never retrieved'
                future.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
                self._in_flight[key] = future
                is_leader = True

        if not is_leader:
            # Await the leader's execution result
            result = await future
            return result, True

        # Leader executes the actual work
        try:
            res = await work_fn()
            async with self._lock:
                self._in_flight.pop(key, None)
                if not future.done():
                    future.set_result(res)
            return res, False
        except Exception as exc:
            async with self._lock:
                self._in_flight.pop(key, None)
                if not future.done():
                    future.set_exception(exc)
            raise

    @property
    def active_count(self) -> int:
        """Return number of currently in-flight operations."""
        return len(self._in_flight)


# Global singleton coalescer
request_coalescer = RequestCoalescer()
