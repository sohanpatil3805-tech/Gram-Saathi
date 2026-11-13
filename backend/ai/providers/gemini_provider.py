"""
Gram Saathi — Modular Gemini AI Provider
Implements BaseAIProvider using the official google-genai SDK.
Handles API authentication securely, suppresses secret leakage, and gracefully degrades when unconfigured.
"""

import logging
from typing import Optional, List, Any, Dict

from google import genai
from google.genai import types

from backend.config import settings
from backend.ai.providers.base import (
    BaseAIProvider,
    AIResponse,
    ToolCall,
    AIProviderError,
    AIProviderNotConfiguredError,
    AIModelError,
    AIRateLimitError,
)

logger = logging.getLogger(__name__)


class GeminiProvider(BaseAIProvider):
    """
    Google Gemini Provider for Gram Saathi.
    Uses Gemini 2.0 Flash (or configured model) for reasoning and multilingual dialogue.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        """
        Initialize the Gemini Provider.
        If api_key is omitted, it reads securely from backend.config.settings.
        The raw key is stored in memory only and never logged or exposed.
        """
        self._explicit_key = api_key
        self._model_name = model_name or settings.gemini_model
        self._client: Optional[genai.Client] = None

    def is_configured(self) -> bool:
        """
        Returns True if a non-empty API key is available.
        Does NOT validate against Google servers; simply verifies local presence.
        """
        if self._explicit_key:
            return bool(self._explicit_key.strip())
        return settings.is_gemini_configured

    def get_model_name(self) -> str:
        return self._model_name

    def get_provider_name(self) -> str:
        return "gemini"

    def _get_client(self) -> genai.Client:
        """
        Lazily initialize and return the GenAI Client.
        Raises AIProviderNotConfiguredError if key is missing.
        """
        if not self.is_configured():
            raise AIProviderNotConfiguredError(
                provider_name="Gemini",
                message=(
                    "Gemini API key is not configured. "
                    "Please set GEMINI_API_KEY in the root .env file. "
                    "Unrelated backend services remain operational."
                )
            )

        if self._client is None:
            raw_key = self._explicit_key or settings.get_gemini_api_key()
            if not raw_key:
                raise AIProviderNotConfiguredError(provider_name="Gemini")
            # Client receives the raw key in memory; never print or log raw_key
            self._client = genai.Client(api_key=raw_key)

        return self._client

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        temperature: float = 0.2,
    ) -> AIResponse:
        """
        Execute prompt generation asynchronously via Gemini.

        Args:
            prompt: Citizen message or orchestrator prompt.
            system_instruction: System prompt (e.g. persona and language context).
            tools: Allowlisted function declarations or tool objects.
            temperature: Sampling temperature (default 0.2 for deterministic reasoning).

        Returns:
            AIResponse with text reply and any tool call requests.
        """
        # Guard: Check configuration before proceeding
        client = self._get_client()

        # Build execution configuration
        config_kwargs: Dict[str, Any] = {
            "temperature": temperature,
        }
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction

        if tools:
            config_kwargs["tools"] = tools

        config = types.GenerateContentConfig(**config_kwargs)

        try:
            # Async call via client.aio
            response = await client.aio.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=config,
            )

            # Parse tool calls from candidate parts
            tool_calls: List[ToolCall] = []
            reply_text: Optional[str] = None

            if response.function_calls:
                for fc in response.function_calls:
                    # Convert function call to our standardized ToolCall DTO
                    tool_calls.append(
                        ToolCall(
                            name=fc.name,
                            args=dict(fc.args) if fc.args else {},
                        )
                    )

            if response.text:
                reply_text = response.text

            finish_reason = None
            if response.candidates and len(response.candidates) > 0:
                first_cand = response.candidates[0]
                if hasattr(first_cand, "finish_reason"):
                    finish_reason = str(first_cand.finish_reason)

            return AIResponse(
                text=reply_text,
                tool_calls=tool_calls,
                finish_reason=finish_reason,
                model_name=self._model_name,
                provider_name="gemini",
                is_simulated=False,
            )

        except AIProviderNotConfiguredError:
            raise
        except Exception as e:
            # Sanitize error message to prevent any accidental key echo
            err_str = str(e)
            raw_key = self._explicit_key or settings.get_gemini_api_key()
            if raw_key and raw_key in err_str:
                err_str = err_str.replace(raw_key, "[REDACTED]")

            # Classify error type
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                logger.warning("Gemini rate limit encountered: %s", err_str)
                raise AIRateLimitError(f"Gemini API rate limit reached: {err_str}") from e

            logger.error("Gemini invocation failed: %s", err_str)
            raise AIModelError(f"Gemini generation error: {err_str}") from e
