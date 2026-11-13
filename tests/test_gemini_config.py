"""
Tests for Gram Saathi Gemini API Configuration and Modular Provider.
Verifies secure key reading, secret masking, graceful unconfigured error handling, and provider abstraction.
"""

import sys
from pathlib import Path
import asyncio

# Add project root to sys.path so 'backend' imports work cleanly
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.config import settings, Settings
from backend.ai.providers import (
    GeminiProvider,
    MockAIProvider,
    BaseAIProvider,
    AIProviderNotConfiguredError,
    create_ai_provider,
    get_ai_health_status,
)


def test_settings_does_not_leak_key_in_repr():
    """Verify that SecretStr prevents the key from being printed or exposed in repr."""
    # Test with a dummy key
    test_settings = Settings(
        GEMINI_API_KEY="AIzaSyDummySecretKeyForTest12345"
    )
    assert test_settings.is_gemini_configured is True
    # repr or str MUST mask the key
    assert "AIzaSyDummySecretKeyForTest12345" not in repr(test_settings)
    assert "AIzaSyDummySecretKeyForTest12345" not in str(test_settings.gemini_api_key)
    assert "**********" in str(test_settings.gemini_api_key)


def test_settings_safe_ai_status_omits_key():
    """Verify that get_safe_ai_status returns only metadata, never secret strings."""
    test_settings = Settings(
        GEMINI_API_KEY="AIzaSyDummySecretKeyForTest12345"
    )
    status = test_settings.get_safe_ai_status()
    assert "key" not in status
    assert "gemini_api_key" not in status
    assert status["is_configured"] is True
    assert status["provider"] == "gemini"


def test_unconfigured_gemini_provider_behavior():
    """Verify that an unconfigured GeminiProvider reports is_configured=False and raises clear error on generate."""
    provider = GeminiProvider(api_key=None)
    # When api_key is None and settings has no key
    if not settings.is_gemini_configured:
        assert provider.is_configured() is False

        # Attempting generation must raise AIProviderNotConfiguredError without crashing the process
        async def run_gen():
            await provider.generate("ಹಲೋ")

        error_raised = False
        try:
            asyncio.run(run_gen())
        except AIProviderNotConfiguredError as exc:
            error_raised = True
            assert "Please set GEMINI_API_KEY" in str(exc)
            assert "Unrelated backend services" in str(exc)

        assert error_raised is True, "AIProviderNotConfiguredError was expected but not raised"


def test_mock_provider_works():
    """Verify that MockAIProvider provides a functional fallback."""
    provider = MockAIProvider()
    assert provider.is_configured() is True
    assert provider.get_provider_name() == "mock"

    res = asyncio.run(provider.generate("ನನಗೆ ಕಿಸಾನ್ ಯೋಜನೆ ಬೇಕು"))
    assert res.is_simulated is True
    assert res.has_tool_calls is True
    assert res.tool_calls[0].name == "search_schemes"


def test_factory_creation():
    """Verify create_ai_provider returns proper provider instance."""
    mock_prov = create_ai_provider("mock")
    assert isinstance(mock_prov, MockAIProvider)

    gemini_prov = create_ai_provider("gemini", fallback_to_mock_if_unconfigured=False)
    assert isinstance(gemini_prov, GeminiProvider)

    status = get_ai_health_status()
    assert "is_configured" in status
    assert "status" in status
    assert "key" not in status


if __name__ == "__main__":
    print("Running Gemini Configuration and Provider tests...")
    test_settings_does_not_leak_key_in_repr()
    print("PASS: test_settings_does_not_leak_key_in_repr")
    test_settings_safe_ai_status_omits_key()
    print("PASS: test_settings_safe_ai_status_omits_key")
    test_unconfigured_gemini_provider_behavior()
    print("PASS: test_unconfigured_gemini_provider_behavior")
    test_mock_provider_works()
    print("PASS: test_mock_provider_works")
    test_factory_creation()
    print("PASS: test_factory_creation")
    print("\nALL GEMINI CONFIGURATION & SECURITY TESTS PASSED!")
