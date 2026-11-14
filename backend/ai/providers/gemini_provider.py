"""
Google Gemini Provider for Gram Saathi.
Implements bounded exponential backoff with jitter for HTTP 429, 503, and 504 errors,
respects Retry-After metadata, detects daily quota exhaustion immediately without looping,
and ensures strict API key and PII redaction across all logs.
"""
from __future__ import annotations

import asyncio
import logging
import random
import re
from typing import Optional, List, Any, Dict

from google import genai
from google.genai import types

from backend.config import settings
from backend.ai.providers.base import (
    BaseAIProvider,
    AIResponse,
    ToolCall,
    AIProviderNotConfiguredError,
    AIModelError,
    AIRateLimitError,
    AIServiceUnavailableError,
    AIGatewayTimeoutError,
)

logger = logging.getLogger(__name__)

# Preserved constants for backward compatibility and test contracts
REQUEST_TIMEOUT_MS = 20000
RETRY_DELAY_SECONDS = 2
MAX_RETRIES = 1
BASE_BACKOFF_SECONDS = 1.0
MAX_RETRY_DELAY_SECONDS = 5.0
MAX_ACCEPTABLE_RETRY_AFTER = 10.0


def _sanitize_error_text(text: str) -> str:
    """Strip any potential API keys or sensitive authorization parameters from error strings."""
    if not text:
        return ""
    sanitized = re.sub(r"key=[A-Za-z0-9_-]+", "key=[REDACTED]", text)
    sanitized = re.sub(r"AIza[0-9A-Za-z-_]{35}", "[REDACTED_API_KEY]", sanitized)
    sanitized = re.sub(r"bearer\s+[A-Za-z0-9._-]+", "bearer [REDACTED]", sanitized, flags=re.IGNORECASE)
    return sanitized


def _parse_retry_delay(text: str) -> Optional[float]:
    """Extract retry delay in seconds from error text, headers, or structured details."""
    if not text:
        return None

    # 1. Look for retryDelay: '40800s' or retryDelay: 1.5s
    delay_match = re.search(r"['\"]?retryDelay['\"]?\s*:\s*['\"]?(\d+(?:\.\d+)?)(?:s)?['\"]?", text, re.IGNORECASE)
    if delay_match:
        try:
            return float(delay_match.group(1))
        except (ValueError, TypeError):
            pass

    # 2. Look for retry in 11h20m0s or 5s
    hms_match = re.search(r"retry in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?", text, re.IGNORECASE)
    if hms_match and any(hms_match.groups()):
        hours = float(hms_match.group(1) or 0)
        minutes = float(hms_match.group(2) or 0)
        seconds = float(hms_match.group(3) or 0)
        total = hours * 3600 + minutes * 60 + seconds
        if total > 0:
            return total

    # 3. Look for retry-after: 5
    header_match = re.search(r"retry-after[:\s]+(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if header_match:
        try:
            return float(header_match.group(1))
        except (ValueError, TypeError):
            pass

    return None


def _classify_gemini_error(error: Exception) -> Dict[str, Any]:
    """
    Categorize Gemini error into distinct categories:
    - DAILY_QUOTA (HTTP 429, daily free tier limit) -> unretryable
    - RATE_LIMIT_429 (HTTP 429, temporary RPM spike) -> retryable
    - SERVICE_UNAVAILABLE_503 (HTTP 503) -> retryable
    - GATEWAY_TIMEOUT_504 (HTTP 504) -> retryable
    - CLIENT_TIMEOUT (asyncio.TimeoutError) -> unretryable
    - OTHER -> unretryable
    """
    raw_text = str(error)
    sanitized = _sanitize_error_text(raw_text)
    lower = sanitized.lower()

    # Determine numeric HTTP status code
    status_code: Optional[int] = getattr(error, "code", None) or getattr(error, "status_code", None)
    if not isinstance(status_code, int):
        code_match = re.search(r"\b(429|503|504|502)\b", sanitized)
        if code_match:
            try:
                status_code = int(code_match.group(1))
            except (ValueError, TypeError):
                status_code = None

    retry_after = _parse_retry_delay(raw_text)

    # 1. Check for Daily Quota Exhaustion (429 free tier limit)
    daily_quota_indicators = (
        "per day",
        "per_day",
        "daily quota",
        "daily limit",
        "free_tier_requests",
        "requests per day limit exceeded",
        "generativelanguage.googleapis.com/generate_content_free_tier_requests",
        "quota exceeded for metric",
        "quota exhausted",
    )
    is_429_or_quota = (status_code == 429) or any(m in lower for m in ("429", "resource_exhausted", "quota", "rate limit", "too many requests"))

    if is_429_or_quota:
        if any(ind in lower for ind in daily_quota_indicators) or (retry_after is not None and retry_after > MAX_ACCEPTABLE_RETRY_AFTER):
            return {
                "category": "DAILY_QUOTA",
                "status_code": 429,
                "retry_after": retry_after,
                "sanitized_message": "Daily free-tier request quota exceeded on Google Gemini API",
                "is_retryable": False,
            }
        return {
            "category": "RATE_LIMIT_429",
            "status_code": 429,
            "retry_after": retry_after,
            "sanitized_message": "Gemini API rate limit reached (429 Too Many Requests)",
            "is_retryable": True,
        }

    # 2. Check for 503 Service Unavailable
    if status_code == 503 or any(m in lower for m in ("503", "service unavailable", "temporarily unavailable")):
        return {
            "category": "SERVICE_UNAVAILABLE_503",
            "status_code": 503,
            "retry_after": retry_after,
            "sanitized_message": "Gemini service temporarily unavailable (503 Service Unavailable)",
            "is_retryable": True,
        }

    # 3. Check for 504 Gateway Timeout
    if status_code == 504 or any(m in lower for m in ("504", "gateway timeout", "gateway time-out", "deadline exceeded")):
        return {
            "category": "GATEWAY_TIMEOUT_504",
            "status_code": 504,
            "retry_after": retry_after,
            "sanitized_message": "Gemini gateway timed out (504 Gateway Timeout)",
            "is_retryable": True,
        }

    # 4. Check for Client-side Timeout
    if isinstance(error, asyncio.TimeoutError):
        return {
            "category": "CLIENT_TIMEOUT",
            "status_code": None,
            "retry_after": None,
            "sanitized_message": "Client request timed out waiting for Gemini response",
            "is_retryable": False,
        }

    # 5. Check for Network / Socket errors
    if any(m in lower for m in ("connection reset", "connection aborted", "connection refused", "connection attempts failed", "network error", "dns", "socket", "network is unreachable")):
        return {
            "category": "NETWORK_ERROR",
            "status_code": None,
            "retry_after": retry_after,
            "sanitized_message": "Network or connection error communicating with Gemini API",
            "is_retryable": True,
        }

    return {
        "category": "OTHER",
        "status_code": status_code,
        "retry_after": retry_after,
        "sanitized_message": sanitized[:120],
        "is_retryable": False,
    }


def _extract_rate_limit_info(error: Exception) -> tuple[bool, bool, Optional[float], str]:
    """Compatibility wrapper for rate limit extraction."""
    info = _classify_gemini_error(error)
    is_rl = info["category"] in ("DAILY_QUOTA", "RATE_LIMIT_429")
    is_daily = info["category"] == "DAILY_QUOTA"
    return is_rl, is_daily, info["retry_after"], info["sanitized_message"]


def _is_rate_limit_error(error: Exception) -> bool:
    """Return whether an SDK error represents a provider quota/rate limit."""
    info = _classify_gemini_error(error)
    return info["category"] in ("DAILY_QUOTA", "RATE_LIMIT_429")


def _is_retryable_temporary_error(error: Exception) -> bool:
    """Return whether an error is a transient service or network failure."""
    info = _classify_gemini_error(error)
    return info["is_retryable"] and info["category"] in ("SERVICE_UNAVAILABLE_503", "GATEWAY_TIMEOUT_504", "NETWORK_ERROR", "RATE_LIMIT_429")


def _calculate_backoff_delay(attempt: int, retry_after: Optional[float] = None) -> float:
    """Calculate bounded backoff delay with exponential backoff and jitter."""
    if retry_after is not None and 0 < retry_after <= MAX_ACCEPTABLE_RETRY_AFTER:
        # Respect Retry-After with a small jitter
        return min(retry_after + random.uniform(0.01, 0.1), MAX_RETRY_DELAY_SECONDS)
    if attempt == 0:
        return RETRY_DELAY_SECONDS
    delay = (RETRY_DELAY_SECONDS * (2 ** attempt)) + random.uniform(0.1, 0.4)
    return min(delay, MAX_RETRY_DELAY_SECONDS)


class GeminiProvider(BaseAIProvider):
    """Google Gemini provider for Gram Saathi."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self._explicit_key = api_key
        self._model_name = model_name or settings.gemini_model
        self._client: Optional[genai.Client] = None

    def is_configured(self) -> bool:
        if self._explicit_key:
            return bool(self._explicit_key.strip())
        return settings.is_gemini_configured

    def get_model_name(self) -> str:
        return self._model_name

    def get_provider_name(self) -> str:
        return "gemini"

    def _get_client(self) -> genai.Client:
        if not self.is_configured():
            raise AIProviderNotConfiguredError(
                provider_name="Gemini",
                message=(
                    "Gemini API key is not configured. Please set "
                    "GEMINI_API_KEY in the root .env file. Unrelated backend "
                    "services remain operational."
                ),
            )

        if self._client is None:
            raw_key = (
                self._explicit_key
                or settings.get_gemini_api_key()
            )

            if not raw_key:
                raise AIProviderNotConfiguredError(
                    provider_name="Gemini"
                )

            self._client = genai.Client(
                api_key=raw_key,
                http_options=types.HttpOptions(
                    timeout=REQUEST_TIMEOUT_MS
                ),
            )

        return self._client

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        temperature: float = 0.2,
    ) -> AIResponse:

        client = self._get_client()

        config_kwargs: Dict[str, Any] = {
            "temperature": temperature,
            "automatic_function_calling": types.AutomaticFunctionCallingConfig(disable=True),
        }

        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction

        if tools:
            config_kwargs["tools"] = tools

        config = types.GenerateContentConfig(**config_kwargs)

        response = None

        try:
            for attempt in range(MAX_RETRIES + 1):
                try:
                    response = await asyncio.wait_for(
                        client.aio.models.generate_content(
                            model=self._model_name,
                            contents=prompt,
                            config=config,
                        ),
                        timeout=REQUEST_TIMEOUT_MS / 1000,
                    )
                    break

                except Exception as call_error:
                    info = _classify_gemini_error(call_error)

                    # 1. Sanitized logging per error category
                    if info["category"] == "DAILY_QUOTA":
                        logger.warning(
                            "Gemini API HTTP 429 [Daily Quota Exhausted]: retry_after=%s, details=%s. Not retrying.",
                            info["retry_after"],
                            info["sanitized_message"],
                        )
                    elif info["category"] == "RATE_LIMIT_429":
                        logger.warning(
                            "Gemini API HTTP 429 [Temporary Rate Limit]: retry_after=%s, details=%s.",
                            info["retry_after"],
                            info["sanitized_message"],
                        )
                    elif info["category"] == "SERVICE_UNAVAILABLE_503":
                        logger.warning(
                            "Gemini API HTTP 503 [Service Unavailable]: retry_after=%s, details=%s.",
                            info["retry_after"],
                            info["sanitized_message"],
                        )
                    elif info["category"] == "GATEWAY_TIMEOUT_504":
                        logger.warning(
                            "Gemini API HTTP 504 [Gateway Timeout]: details=%s.",
                            info["sanitized_message"],
                        )
                    elif info["category"] == "CLIENT_TIMEOUT":
                        logger.warning(
                            "Gemini request timed out after %s ms.",
                            REQUEST_TIMEOUT_MS,
                        )
                    else:
                        logger.warning(
                            "Gemini API error [category=%s, status=%s]: %s",
                            info["category"],
                            info["status_code"],
                            info["sanitized_message"],
                        )

                    # 2. Check retryability and remaining attempt budget
                    if not info["is_retryable"] or attempt >= MAX_RETRIES:
                        if info["category"] == "DAILY_QUOTA":
                            raise AIRateLimitError(
                                message=f"Gemini API rate limit reached (daily quota exhausted): {info['sanitized_message']}",
                                is_daily_quota=True,
                                retry_after_seconds=info["retry_after"],
                            ) from call_error

                        if info["category"] == "RATE_LIMIT_429":
                            raise AIRateLimitError(
                                message=f"Gemini API rate limit reached (429): {info['sanitized_message']}",
                                is_daily_quota=False,
                                retry_after_seconds=info["retry_after"],
                            ) from call_error

                        if info["category"] == "SERVICE_UNAVAILABLE_503":
                            raise AIServiceUnavailableError(
                                message=f"Gemini generation failed (503 Service Unavailable): {info['sanitized_message']}",
                                retry_after_seconds=info["retry_after"],
                            ) from call_error

                        if info["category"] == "GATEWAY_TIMEOUT_504":
                            raise AIGatewayTimeoutError(
                                message=f"Gemini generation failed (504 Gateway Timeout): {info['sanitized_message']}",
                                retry_after_seconds=info["retry_after"],
                            ) from call_error

                        if info["category"] == "CLIENT_TIMEOUT":
                            raise AIModelError("Gemini request timed out. Please try again.") from call_error

                        raise AIModelError(f"Gemini generation failed: {info['sanitized_message']}") from call_error

                    # 3. Bounded exponential backoff with jitter
                    delay = _calculate_backoff_delay(attempt, info["retry_after"])
                    logger.info(
                        "Retrying Gemini call after %s (HTTP %s, attempt %d/%d) in %.2fs with jitter.",
                        info["category"],
                        info["status_code"] or "n/a",
                        attempt + 1,
                        MAX_RETRIES,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    continue

            if response is None:
                raise AIModelError("Gemini did not return a response.")

            tool_calls: List[ToolCall] = []

            if response.function_calls:
                for fc in response.function_calls:
                    tool_calls.append(
                        ToolCall(
                            name=fc.name,
                            args=dict(fc.args) if fc.args else {},
                        )
                    )

            reply_text = response.text or None
            finish_reason = None

            if response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "finish_reason"):
                    finish_reason = str(candidate.finish_reason)

            return AIResponse(
                text=reply_text,
                tool_calls=tool_calls,
                finish_reason=finish_reason,
                model_name=self._model_name,
                provider_name="gemini",
                is_simulated=False,
            )

        except (AIProviderNotConfiguredError, AIRateLimitError, AIServiceUnavailableError, AIGatewayTimeoutError, AIModelError):
            raise

        except asyncio.TimeoutError as error:
            logger.warning("Gemini request timed out after %s ms.", REQUEST_TIMEOUT_MS)
            raise AIModelError("Gemini request timed out. Please try again.") from error

        except Exception as error:
            info = _classify_gemini_error(error)
            if info["category"] in ("DAILY_QUOTA", "RATE_LIMIT_429"):
                raise AIRateLimitError(
                    message=f"Gemini API rate limit reached: {info['sanitized_message']}",
                    is_daily_quota=(info["category"] == "DAILY_QUOTA"),
                    retry_after_seconds=info["retry_after"],
                ) from error
            if info["category"] == "SERVICE_UNAVAILABLE_503":
                raise AIServiceUnavailableError(
                    message=f"Gemini service unavailable (503): {info['sanitized_message']}",
                    retry_after_seconds=info["retry_after"],
                ) from error
            if info["category"] == "GATEWAY_TIMEOUT_504":
                raise AIGatewayTimeoutError(
                    message=f"Gemini gateway timed out (504): {info['sanitized_message']}",
                    retry_after_seconds=info["retry_after"],
                ) from error

            sanitized = _sanitize_error_text(str(error))
            logger.error("Gemini invocation failed: %s", sanitized[:120])
            raise AIModelError("Gemini generation failed. Please try again.") from error
