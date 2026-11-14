"""
Unit and integration tests for Gemini API rate-limit resilience, bounded retries,
daily quota exhaustion detection, non-personal scheme caching, request coalescing,
and deterministic fallbacks across HTTP 429, 503, and 504 error categories.
"""
import asyncio
import logging
from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.ai.providers.base import (
    AIModelError,
    AIProviderNotConfiguredError,
    AIRateLimitError,
    AIServiceUnavailableError,
    AIGatewayTimeoutError,
    AIResponse,
)
from backend.ai.providers.gemini_provider import (
    GeminiProvider,
    _classify_gemini_error,
    _extract_rate_limit_info,
    _parse_retry_delay,
    _sanitize_error_text,
    _calculate_backoff_delay,
    MAX_RETRIES,
)
from backend.ai.cache import SchemeGuidanceCache, is_cacheable_prompt
from backend.ai.concurrency import RequestCoalescer
from backend.api.routes import create_router


class FakeModels:
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)
        self.calls = 0
        self.last_kwargs = {}

    async def generate_content(self, **kwargs):
        self.calls += 1
        self.last_kwargs = kwargs
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def make_provider(outcomes):
    provider = GeminiProvider(api_key="test-dummy-key", model_name="gemini-test-model")
    models = FakeModels(outcomes)
    provider._client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return provider, models


def dummy_response(text="Verified Scheme Guidance"):
    return SimpleNamespace(
        function_calls=[],
        text=text,
        candidates=[],
    )


# ─── 1. Rate Limit & Error Classification Tests ───────────────────────────────

def test_classify_error_categories():
    # 429 Daily Quota
    err_quota = RuntimeError("429 RESOURCE_EXHAUSTED: requests per day limit exceeded on Free Tier. retryDelay: '40800s'")
    info = _classify_gemini_error(err_quota)
    assert info["category"] == "DAILY_QUOTA"
    assert info["status_code"] == 429
    assert info["is_retryable"] is False

    # 429 Temporary Rate Limit
    err_rpm = RuntimeError("429 Too Many Requests: Rate limit exceeded. retryDelay: '2.5s'")
    info_rpm = _classify_gemini_error(err_rpm)
    assert info_rpm["category"] == "RATE_LIMIT_429"
    assert info_rpm["status_code"] == 429
    assert info_rpm["is_retryable"] is True
    assert info_rpm["retry_after"] == 2.5

    # 503 Service Unavailable
    err_503 = RuntimeError("503 Service Unavailable: The backend is temporarily overloaded.")
    info_503 = _classify_gemini_error(err_503)
    assert info_503["category"] == "SERVICE_UNAVAILABLE_503"
    assert info_503["status_code"] == 503
    assert info_503["is_retryable"] is True

    # 504 Gateway Timeout
    err_504 = RuntimeError("504 Gateway Time-out: The upstream server took too long to respond.")
    info_504 = _classify_gemini_error(err_504)
    assert info_504["category"] == "GATEWAY_TIMEOUT_504"
    assert info_504["status_code"] == 504
    assert info_504["is_retryable"] is True


def test_sanitize_error_text_removes_keys():
    raw = "Failed on URL https://api.google.com?key=AIzaSyA1234567890123456789012345678901 with auth bearer secret_token_xyz"
    sanitized = _sanitize_error_text(raw)
    assert "AIzaSyA1234567890123456789012345678901" not in sanitized
    assert "secret_token_xyz" not in sanitized
    assert "[REDACTED" in sanitized


def test_afc_is_explicitly_disabled():
    provider, models = make_provider([dummy_response("No AFC needed")])
    res = asyncio.run(provider.generate("Tell me about schemes"))
    assert res.text == "No AFC needed"
    config = models.last_kwargs.get("config")
    assert config is not None
    assert getattr(config, "automatic_function_calling", None) is not None
    assert config.automatic_function_calling.disable is True


# ─── 2. Retries & Bounded Backoff per Error Category ──────────────────────────

def test_daily_quota_exhaustion_fails_immediately_without_retry(monkeypatch):
    quota_err = RuntimeError(
        "429 RESOURCE_EXHAUSTED: Generate content requests per day limit exceeded on Free Tier. "
        "{'retryDelay': '40800s'}"
    )
    provider, models = make_provider([quota_err])

    async def should_not_sleep(_delay):
        pytest.fail("Daily quota exhaustion must NOT sleep or retry")

    monkeypatch.setattr(asyncio, "sleep", should_not_sleep)

    with pytest.raises(AIRateLimitError) as exc_info:
        asyncio.run(provider.generate("What is PM-KISAN?"))

    assert exc_info.value.is_daily_quota is True
    assert models.calls == 1


def test_temporary_rate_limit_retries_and_succeeds(monkeypatch):
    temp_429 = RuntimeError("429 Rate limit exceeded. retryDelay: '1.5s'")
    provider, models = make_provider([temp_429, dummy_response("Success after retry")])

    slept_delays = []

    async def fake_sleep(delay):
        slept_delays.append(delay)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    res = asyncio.run(provider.generate("Tell me about schemes"))

    assert res.text == "Success after retry"
    assert models.calls == 2
    assert len(slept_delays) == 1
    assert slept_delays[0] >= 1.5


def test_503_service_unavailable_retries_with_backoff(monkeypatch):
    err_503 = RuntimeError("503 Service Unavailable: High load")
    provider, models = make_provider([err_503, dummy_response("Recovered from 503")])

    slept_delays = []

    async def fake_sleep(delay):
        slept_delays.append(delay)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    res = asyncio.run(provider.generate("Check farmer subsidy"))

    assert res.text == "Recovered from 503"
    assert models.calls == 2
    assert len(slept_delays) == 1


def test_503_exhausts_retries_and_raises_service_unavailable(monkeypatch):
    err_503 = RuntimeError("503 Service Unavailable: Server down")
    provider, models = make_provider([err_503] * (MAX_RETRIES + 1))

    async def noop_sleep(_d): pass
    monkeypatch.setattr(asyncio, "sleep", noop_sleep)

    with pytest.raises(AIServiceUnavailableError) as exc_info:
        asyncio.run(provider.generate("Tell me about schemes"))

    assert exc_info.value.status_code == 503
    assert models.calls == MAX_RETRIES + 1


def test_504_gateway_timeout_retries_and_raises_gateway_timeout(monkeypatch):
    err_504 = RuntimeError("504 Gateway Time-out: upstream timeout")
    provider, models = make_provider([err_504] * (MAX_RETRIES + 1))

    async def noop_sleep(_d): pass
    monkeypatch.setattr(asyncio, "sleep", noop_sleep)

    with pytest.raises(AIGatewayTimeoutError) as exc_info:
        asyncio.run(provider.generate("Tell me about schemes"))

    assert exc_info.value.status_code == 504
    assert models.calls == MAX_RETRIES + 1


# ─── 3. Request Coalescing (Duplicate Concurrent Request Prevention) ───────────

def test_request_coalescer_merges_concurrent_calls():
    coalescer = RequestCoalescer()
    call_count = 0

    async def slow_work():
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)
        return "Coalesced Result"

    async def run_concurrent():
        # Fire 3 identical requests simultaneously
        task1 = asyncio.create_task(coalescer.execute_or_join("en", "farmer", "Karnataka", "What schemes apply?", slow_work))
        task2 = asyncio.create_task(coalescer.execute_or_join("en", "farmer", "Karnataka", "What schemes apply?", slow_work))
        task3 = asyncio.create_task(coalescer.execute_or_join("en", "farmer", "Karnataka", "What schemes apply?", slow_work))
        return await asyncio.gather(task1, task2, task3)

    results = asyncio.run(run_concurrent())

    # Verify slow_work was called exactly ONCE
    assert call_count == 1
    # Check results: all 3 received the identical answer
    assert results[0][0] == "Coalesced Result"
    assert results[1][0] == "Coalesced Result"
    assert results[2][0] == "Coalesced Result"
    # Leader was not coalesced (False); followers were coalesced (True)
    was_coalesced_flags = [r[1] for r in results]
    assert False in was_coalesced_flags
    assert True in was_coalesced_flags


# ─── 4. Non-Personal Scheme Guidance Cache ─────────────────────────────────────

def test_cache_stores_and_retrieves_public_query():
    cache = SchemeGuidanceCache(ttl_seconds=10)
    assert cache.get("en", "farmers", "Karnataka", "What schemes are available?") is None

    cache.set("en", "farmers", "Karnataka", "What schemes are available?", "Here are the schemes: PM-KISAN")
    cached = cache.get("en", "farmers", "Karnataka", "What schemes are available?")
    assert cached == "Here are the schemes: PM-KISAN"


def test_cache_rejects_personal_and_sensitive_queries():
    assert is_cacheable_prompt("What schemes support small farmers in Karnataka?") is True
    assert is_cacheable_prompt("My phone number is 9876543210") is False
    assert is_cacheable_prompt("My Aadhaar is 123456789012") is False
    assert is_cacheable_prompt("My income is 85000 per year") is False
    assert is_cacheable_prompt("I have 5 acres of land") is False

    cache = SchemeGuidanceCache()
    cache.set("en", "farmers", "Karnataka", "My phone is 9876543210", "Secret")
    assert cache.get("en", "farmers", "Karnataka", "My phone is 9876543210") is None


# ─── 5. Distinct User-Facing Fallback Messages in Chat API ──────────────────────

class FakeFailingAIProvider:
    def __init__(self, error):
        self.error = error

    async def generate(self, *args, **kwargs):
        raise self.error


class FakeRepoForFallback:
    def load(self): pass
    def find_for_beneficiary(self, group, state):
        return [{
            "scheme_id": "PM_KISAN_DEMO",
            "name": {"en": "PM Kisan Scheme", "kn": "ಪಿಎಂ ಕಿಸಾನ್ ಯೋಜನೆ", "hi": "पीएम किसान योजना"},
            "summary": {"en": "Annual income support for farmers.", "kn": "ರೈತರಿಗೆ ವಾರ್ಷಿಕ ಆರ್ಥಿಕ ನೆರವು.", "hi": "किसानों को वार्षिक आय सहायता।"},
            "benefit": {"description": "Rs. 6000 per year in 3 installments"},
            "jurisdiction": "central",
            "verification_status": "verified",
            "eligibility_rules": [],
            "required_documents": [{"name": "Land Record", "item": "Land Record"}],
            "official_urls": ["https://pmkisan.gov.in"],
        }]
    def sources_for_scheme(self, scheme_id): return []
    def all_schemes(self): return []
    def get_scheme(self, scheme_id): return None


def test_chat_returns_distinct_fallback_notices_for_429_503_504():
    # 1. Test 503 fallback
    app_503 = FastAPI()
    app_503.include_router(create_router(FakeRepoForFallback(), FakeFailingAIProvider(AIServiceUnavailableError("503 Server Down"))))
    client_503 = TestClient(app_503)
    res_503 = client_503.post("/api/chat", json={
        "message": "Can you explain how subsidy funds are disbursed?",
        "beneficiary_group": "farmers",
        "state": "Karnataka",
        "language": "en"
    })
    assert res_503.status_code == 200
    assert "503 Service Unavailable" in res_503.json()["reply"]
    assert "PM Kisan Scheme" in res_503.json()["reply"]

    # 2. Test 504 fallback
    app_504 = FastAPI()
    app_504.include_router(create_router(FakeRepoForFallback(), FakeFailingAIProvider(AIGatewayTimeoutError("504 Gateway Timeout"))))
    client_504 = TestClient(app_504)
    res_504 = client_504.post("/api/chat", json={
        "message": "Can you explain how subsidy funds are disbursed?",
        "beneficiary_group": "farmers",
        "state": "Karnataka",
        "language": "en"
    })
    assert res_504.status_code == 200
    assert "504 Gateway Timeout" in res_504.json()["reply"]

    # 3. Test 429 Daily Quota fallback
    app_quota = FastAPI()
    app_quota.include_router(create_router(FakeRepoForFallback(), FakeFailingAIProvider(AIRateLimitError("Quota limit reached", is_daily_quota=True))))
    client_quota = TestClient(app_quota)
    res_quota = client_quota.post("/api/chat", json={
        "message": "Can you explain how subsidy funds are disbursed?",
        "beneficiary_group": "farmers",
        "state": "Karnataka",
        "language": "en"
    })
    assert res_quota.status_code == 200
    assert "AI daily quota limit reached" in res_quota.json()["reply"]
