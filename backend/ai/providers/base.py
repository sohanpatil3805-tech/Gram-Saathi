"""
Gram Saathi — AI Provider Base Interfaces and Data Models
Defines the abstract interface and data structures for modular AI providers.
Allows swapping or upgrading LLM providers (Gemini, Claude, Mock) without modifying business logic.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


# ─── Exceptions ──────────────────────────────────────────────────────────────

class AIProviderError(Exception):
    """Base exception for all AI provider errors."""
    pass


class AIProviderNotConfiguredError(AIProviderError):
    """
    Raised when an AI operation is attempted without a valid configured API key.
    Provides a clear, actionable error message without exposing any sensitive details.
    """
    def __init__(
        self,
        provider_name: str = "Gemini",
        message: Optional[str] = None
    ):
        msg = message or (
            f"{provider_name} API is not configured. "
            f"Please set GEMINI_API_KEY in the root .env file. "
            f"Unrelated backend services (schemes, documents, officer portal) remain operational."
        )
        super().__init__(msg)
        self.provider_name = provider_name


class AIModelError(AIProviderError):
    """Raised when the underlying model returns an error or failure."""
    pass


class AIRateLimitError(AIProviderError):
    """Raised when provider rate limits / quota thresholds are reached."""
    pass


# ─── Data Transfer Objects ───────────────────────────────────────────────────

@dataclass
class ToolCall:
    """Represents a single function/tool call requested by the AI model."""
    name: str
    args: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AIResponse:
    """Standardized response from any AI provider."""
    text: Optional[str] = None
    tool_calls: List[ToolCall] = field(default_factory=list)
    finish_reason: Optional[str] = None
    model_name: str = "unknown"
    provider_name: str = "unknown"
    is_simulated: bool = False
    usage: Dict[str, int] = field(default_factory=dict)

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0


# ─── Abstract Provider Base Class ───────────────────────────────────────────

class BaseAIProvider(ABC):
    """
    Abstract interface for AI reasoning and dialogue providers.
    All concrete providers (Gemini, Mock, etc.) must implement these methods.
    """

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if the provider has valid credentials and is ready to execute."""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the active model name (e.g. 'gemini-2.0-flash')."""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the provider identifier (e.g. 'gemini', 'mock')."""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        temperature: float = 0.2,
    ) -> AIResponse:
        """
        Execute prompt generation asynchronously.
        
        Args:
            prompt: User or session message
            system_instruction: System prompt with persona / language instructions
            tools: List of allowlisted tool definitions
            temperature: Sampling temperature (default: 0.2 for deterministic reasoning)

        Returns:
            AIResponse containing text reply and/or tool_calls.

        Raises:
            AIProviderNotConfiguredError: If API key is missing.
            AIModelError: If model call fails.
        """
        pass
