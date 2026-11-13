"""
Gram Saathi — AI Providers Package
Modular AI provider abstraction for Google Gemini with secure key management.
"""

from backend.ai.providers.base import (
    BaseAIProvider,
    AIResponse,
    ToolCall,
    AIProviderError,
    AIProviderNotConfiguredError,
    AIModelError,
    AIRateLimitError,
)
from backend.ai.providers.gemini_provider import GeminiProvider
from backend.ai.providers.mock_provider import MockAIProvider
from backend.ai.providers.factory import (
    get_ai_provider,
    create_ai_provider,
    get_ai_health_status,
)

__all__ = [
    "BaseAIProvider",
    "AIResponse",
    "ToolCall",
    "AIProviderError",
    "AIProviderNotConfiguredError",
    "AIModelError",
    "AIRateLimitError",
    "GeminiProvider",
    "MockAIProvider",
    "get_ai_provider",
    "create_ai_provider",
    "get_ai_health_status",
]
