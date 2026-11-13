"""
Gram Saathi — Configuration Module
Reads configuration securely from root .env using pydantic-settings.
Enforces strict secret masking (SecretStr) so API keys and tokens are never printed or leaked.
"""

from pathlib import Path
from typing import Optional, List, Union
from functools import lru_cache
import logging

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine project root directory (Gram Saathi/)
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
ROOT_ENV_FILE = PROJECT_ROOT / ".env"
LOCAL_ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """
    Central settings for Gram Saathi backend.
    Reads from root .env with fallback to environment variables.
    All secrets use SecretStr to prevent accidental logging or JSON exposure.
    """
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV_FILE), str(LOCAL_ENV_FILE)),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    # ─── AI Configuration ────────────────────────────────────────────────────────
    gemini_api_key: Optional[SecretStr] = Field(
        default=None,
        validation_alias="GEMINI_API_KEY",
        description="Google Gemini API key. Stored as SecretStr; never printed in logs or responses."
    )
    gemini_model: str = Field(
        default="gemini-2.0-flash",
        validation_alias="GEMINI_MODEL",
        description="Gemini model identifier (e.g. gemini-2.0-flash, gemini-1.5-flash)"
    )

    # ─── Security & Auth ─────────────────────────────────────────────────────────
    jwt_secret_key: SecretStr = Field(
        default=SecretStr("insecure-dev-secret-replace-with-secrets-token-hex-in-env"),
        validation_alias="JWT_SECRET_KEY"
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_citizen_expire_minutes: int = Field(default=60, validation_alias="JWT_CITIZEN_EXPIRE_MINUTES")
    jwt_officer_expire_minutes: int = Field(default=480, validation_alias="JWT_OFFICER_EXPIRE_MINUTES")

    # ─── Database ────────────────────────────────────────────────────────────────
    database_url: str = Field(
        default="sqlite+aiosqlite:///./gram_saathi.db",
        validation_alias="DATABASE_URL"
    )

    # ─── Modes ───────────────────────────────────────────────────────────────────
    simulation_mode: bool = Field(default=True, validation_alias="SIMULATION_MODE")
    demo_mode: bool = Field(default=True, validation_alias="DEMO_MODE")

    # ─── WhatsApp ────────────────────────────────────────────────────────────────
    whatsapp_token: Optional[SecretStr] = Field(default=None, validation_alias="WHATSAPP_TOKEN")
    whatsapp_phone_number_id: Optional[str] = Field(default=None, validation_alias="WHATSAPP_PHONE_NUMBER_ID")
    whatsapp_verify_token: str = Field(default="gram-saathi-webhook-verify", validation_alias="WHATSAPP_VERIFY_TOKEN")

    # ─── Storage & Paths ─────────────────────────────────────────────────────────
    storage_path: Path = Field(default=PROJECT_ROOT / "storage", validation_alias="STORAGE_PATH")
    max_upload_size_mb: int = Field(default=5, validation_alias="MAX_UPLOAD_SIZE_MB")

    # ─── CORS ────────────────────────────────────────────────────────────────────
    cors_origins: Union[List[str], str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        validation_alias="CORS_ORIGINS"
    )

    # ─── Rate Limiting & Logs ────────────────────────────────────────────────────
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_gemini_configured(self) -> bool:
        """
        Check if a valid, non-empty Gemini API key is provided.
        Returns False if key is missing, None, or empty placeholder.
        """
        if self.gemini_api_key is None:
            return False
        val = self.gemini_api_key.get_secret_value().strip()
        # Ensure it's not an empty placeholder or default text
        if not val or val.lower() in ("your-gemini-api-key-here", "none", ""):
            return False
        return True

    def get_gemini_api_key(self) -> Optional[str]:
        """
        Safely retrieve the raw API key for the Gemini SDK client.
        Never call this method from logging or serialization code.
        """
        if not self.is_gemini_configured or self.gemini_api_key is None:
            return None
        return self.gemini_api_key.get_secret_value().strip()

    @property
    def is_whatsapp_configured(self) -> bool:
        """Check if WhatsApp Cloud API credentials are provided."""
        if self.whatsapp_token is None:
            return False
        val = self.whatsapp_token.get_secret_value().strip()
        return bool(val and self.whatsapp_phone_number_id)

    def get_safe_ai_status(self) -> dict:
        """
        Returns a safe public dictionary about AI configuration.
        NEVER includes the API key, length of key, or partial characters.
        """
        return {
            "provider": "gemini",
            "model": self.gemini_model,
            "is_configured": self.is_gemini_configured,
            "status": "ready" if self.is_gemini_configured else "unconfigured",
            "simulation_mode": self.simulation_mode,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton instance of Settings."""
    return Settings()


# Global settings instance
settings = get_settings()


# ─── Redacting Logger Setup ──────────────────────────────────────────────────
class SecretFilter(logging.Filter):
    """
    Log filter that intercepts log records and sanitizes potential accidental
    API keys (e.g. AIzaSy... or raw secret strings) from log messages.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            # Check against configured secrets
            if settings.is_gemini_configured:
                raw_key = settings.get_gemini_api_key()
                if raw_key and len(raw_key) > 6 and raw_key in record.msg:
                    record.msg = record.msg.replace(raw_key, "[REDACTED_GEMINI_KEY]")
            if settings.jwt_secret_key:
                raw_jwt = settings.jwt_secret_key.get_secret_value()
                if raw_jwt and len(raw_jwt) > 6 and raw_jwt in record.msg:
                    record.msg = record.msg.replace(raw_jwt, "[REDACTED_JWT_SECRET]")
        return True
