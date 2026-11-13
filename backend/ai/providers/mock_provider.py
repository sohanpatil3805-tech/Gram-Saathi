"""
Gram Saathi — Mock AI Provider
Fallback simulated provider for offline testing and development when GEMINI_API_KEY is not set.
Provides deterministic, simulated replies in Kannada and Hindi with is_simulated=True.
"""

from typing import Optional, List, Any
import logging

from backend.ai.providers.base import (
    BaseAIProvider,
    AIResponse,
    ToolCall,
)

logger = logging.getLogger(__name__)


class MockAIProvider(BaseAIProvider):
    """
    Mock AI Provider for local testing and simulation mode.
    Always marks responses as is_simulated=True.
    """

    def __init__(self, model_name: str = "mock-orchestrator-v1"):
        self._model_name = model_name

    def is_configured(self) -> bool:
        return True

    def get_model_name(self) -> str:
        return self._model_name

    def get_provider_name(self) -> str:
        return "mock"

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        temperature: float = 0.2,
    ) -> AIResponse:
        logger.info("[SIMULATED] MockAIProvider generating response for prompt length %d", len(prompt))

        lower_prompt = prompt.lower()
        tool_calls: List[ToolCall] = []
        reply_text: Optional[str] = None

        # Simple keyword-based mock tool calling for demonstration
        if "ಕಿಸಾನ್" in prompt or "kisan" in lower_prompt or "farmer" in lower_prompt:
            tool_calls.append(
                ToolCall(
                    name="search_schemes",
                    args={"query": "PM-KISAN", "target_group": "FARMER", "language": "kn"},
                )
            )
            reply_text = "ರೈತರಿಗಾಗಿ ಪ್ರಧಾನ ಮಂತ್ರಿ ಕಿಸಾನ್ ಸಮ್ಮಾನ್ ನಿಧಿ ಯೋಜನೆಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ [SIMULATED]."
        elif "scholarship" in lower_prompt or "ವಿದ್ಯಾರ್ಥಿ" in prompt or "छात्रवृत्ति" in prompt:
            tool_calls.append(
                ToolCall(
                    name="search_schemes",
                    args={"query": "Scholarship", "target_group": "STUDENT", "language": "hi"},
                )
            )
            reply_text = "छात्रों के लिए छात्रवृत्ति योजनाओं की खोज की जा रही है [SIMULATED]।"
        else:
            reply_text = (
                "ನಮಸ್ಕಾರ! ಗ್ರಾಮ ಸಾಥಿ ಸೇವಾ ವೇದಿಕೆಗೆ ಸ್ವಾಗತ. "
                "ನಾನು ನಿಮಗೆ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ಮತ್ತು ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. [SIMULATED]"
            )

        return AIResponse(
            text=reply_text,
            tool_calls=tool_calls,
            finish_reason="STOP",
            model_name=self._model_name,
            provider_name="mock",
            is_simulated=True,
        )
