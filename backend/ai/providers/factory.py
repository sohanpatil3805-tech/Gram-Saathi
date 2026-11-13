"""
Gram Saathi — AI Provider Factory
Provides single-point access to the configured AI provider.
Enables switching providers (Gemini, Mock, etc.) via configuration or runtime flags.
Ensures missing API keys never crash unrelated backend services.
"""

import logging
from typing import Optional
from functools import lru_cache

from backend.config import settings
from backend.ai.providers.base import BaseAIProvider
from backend.ai.providers.gemini_provider import GeminiProvider
from backend.ai.providers.mock_provider import MockAIProvider

logger = logging.getLogger(__name__)


def create_ai_provider(
    provider_type: Optional[str] = None,
    fallback_to_mock_if_unconfigured: bool = False,
) -> BaseAIProvider:
    """
    Factory function to instantiate an AI provider.
    
    Args:
        provider_type: Optional override ('gemini', 'mock'). Defaults to 'gemini'.
        fallback_to_mock_if_unconfigured: If True and Gemini API key is missing,
            gracefully returns MockAIProvider with a log warning instead of failing.
    
    Returns:
        An instance of BaseAIProvider.
    """
    selected_type = (provider_type or "gemini").lower().strip()

    if selected_type == "mock":
        return MockAIProvider()

    # Default: Gemini
    gemini = GeminiProvider()

    if not gemini.is_configured():
        if fallback_to_mock_if_unconfigured or settings.simulation_mode:
            logger.warning(
                "[SIMULATED] GEMINI_API_KEY is not configured. Falling back to MockAIProvider "
                "for offline development/simulation. Backend services remain fully operational."
            )
            return MockAIProvider()

    return gemini


@lru_cache(maxsize=1)
def get_ai_provider() -> BaseAIProvider:
    """
    Cached singleton provider instance based on application settings.

    A missing Gemini key remains visible to the caller as an actionable
    configuration error; production chat must never silently impersonate an
    AI response with the simulated provider.
    """
    return create_ai_provider(
        provider_type="gemini",
        fallback_to_mock_if_unconfigured=False,
    )


def get_ai_health_status() -> dict:
    """
    Safe public health report for AI services.
    Never exposes API keys, token counts, or sensitive configuration details.
    """
    provider = get_ai_provider()
    return {
        "provider": provider.get_provider_name(),
        "model": provider.get_model_name(),
        "is_configured": provider.is_configured(),
        "is_simulated": isinstance(provider, MockAIProvider),
        "status": "ready" if provider.is_configured() else "unconfigured",
    }
