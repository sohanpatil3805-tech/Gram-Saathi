"""Focused failure-mode tests for the Gemini provider."""

import asyncio
from types import SimpleNamespace

import pytest

from backend.ai.providers.base import (
    AIModelError,
    AIProviderNotConfiguredError,
    AIRateLimitError,
)
from backend.ai.providers.gemini_provider import (
    REQUEST_TIMEOUT_MS,
    RETRY_DELAY_SECONDS,
    GeminiProvider,
)


class FakeModels:
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)
        self.calls = 0

    async def generate_content(self, **_kwargs):
        self.calls += 1
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def make_provider(outcomes):
    provider = GeminiProvider(api_key="test-key")
    models = FakeModels(outcomes)
    provider._client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return provider, models


def response(text="Hello"):
    return SimpleNamespace(
        function_calls=[],
        text=text,
        candidates=[],
    )


def test_missing_api_key_has_actionable_message(monkeypatch):
    provider = GeminiProvider(api_key="")
    monkeypatch.setattr(provider, "is_configured", lambda: False)

    with pytest.raises(AIProviderNotConfiguredError) as exc_info:
        asyncio.run(provider.generate("hello"))

    assert str(exc_info.value) == (
        "Gemini API key is not configured. Please set GEMINI_API_KEY in the "
        "root .env file. Unrelated backend services remain operational."
    )


def test_timeout_uses_request_bound_without_retry(monkeypatch):
    provider, models = make_provider([asyncio.TimeoutError()])

    async def immediate_timeout(awaitable, timeout):
        assert timeout == REQUEST_TIMEOUT_MS / 1000
        await awaitable
        raise asyncio.TimeoutError()

    monkeypatch.setattr(asyncio, "wait_for", immediate_timeout)

    with pytest.raises(AIModelError, match="timed out"):
        asyncio.run(provider.generate("hello"))

    assert models.calls == 1


def test_retry_succeeds_after_one_temporary_503(monkeypatch):
    provider, models = make_provider([RuntimeError("503 Service Unavailable"), response("Recovered")])
    delays = []

    async def fake_sleep(delay):
        delays.append(delay)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    result = asyncio.run(provider.generate("hello"))

    assert result.text == "Recovered"
    assert models.calls == 2
    assert delays == [RETRY_DELAY_SECONDS]


def test_repeated_503_stops_after_one_retry(monkeypatch):
    provider, models = make_provider([
        RuntimeError("503 Service Unavailable"),
        RuntimeError("503 Service Unavailable"),
    ])

    async def fake_sleep(_delay):
        return None

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    with pytest.raises(AIModelError, match="generation failed"):
        asyncio.run(provider.generate("hello"))

    assert models.calls == 2


def test_429_is_not_retried_and_returns_rate_limit(monkeypatch):
    provider, models = make_provider([RuntimeError("429 quota exhausted: test-key")])

    async def should_not_sleep(_delay):
        pytest.fail("Rate-limit errors must not be retried")

    monkeypatch.setattr(asyncio, "sleep", should_not_sleep)

    with pytest.raises(AIRateLimitError, match="rate limit"):
        asyncio.run(provider.generate("hello"))

    assert models.calls == 1
