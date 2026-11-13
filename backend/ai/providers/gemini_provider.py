
import asyncio
import logging
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
)

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_MS = 20000
MAX_RETRIES = 1
RETRY_DELAY_SECONDS = 2


def _is_rate_limit_error(error: Exception) -> bool:
    """Return whether an SDK error represents a provider quota/rate limit."""
    error_text = str(error).lower()
    return "429" in error_text or "quota" in error_text or "rate limit" in error_text


def _is_retryable_temporary_error(error: Exception) -> bool:
    """Return whether an error is a transient service or network failure.

    Timeouts are deliberately excluded. A timeout has already consumed the full
    request budget, so retrying it makes the chat endpoint appear to hang.
    """
    if isinstance(error, asyncio.TimeoutError):
        return False

    error_text = str(error).lower()
    return any(
        marker in error_text
        for marker in (
            "503",
            "service unavailable",
            "temporarily unavailable",
            "connection reset",
            "connection aborted",
            "connection refused",
            "connection attempts failed",
            "network is unreachable",
            "network error",
            "dns",
            "socket",
        )
    )


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

                except Exception as retry_error:
                    if (
                        not _is_retryable_temporary_error(retry_error)
                        or attempt >= MAX_RETRIES
                    ):
                        raise

                    logger.warning(
                        "Gemini temporarily unavailable. "
                        "Retrying once after %s seconds.",
                        RETRY_DELAY_SECONDS,
                    )

                    await asyncio.sleep(RETRY_DELAY_SECONDS)

            if response is None:
                raise AIModelError(
                    "Gemini did not return a response."
                )

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

        except AIProviderNotConfiguredError:
            raise

        except asyncio.TimeoutError as error:
            logger.warning("Gemini request timed out after %s ms.", REQUEST_TIMEOUT_MS)
            raise AIModelError("Gemini request timed out. Please try again.") from error

        except Exception as error:
            if _is_rate_limit_error(error):
                logger.warning("Gemini rate limit encountered.")
                raise AIRateLimitError(
                    "Gemini API rate limit reached."
                ) from error

            # Provider messages can contain request metadata. Do not pass or log
            # them, because they may include credentials or citizen data.
            logger.error("Gemini invocation failed.")
            raise AIModelError("Gemini generation failed. Please try again.") from error
