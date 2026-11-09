import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Secrets are read from the Python process environment, never frontend env."""

    model_config = SettingsConfigDict(env_file=Path(__file__).parents[1] / ".env", extra="ignore",hide_input_in_errors=True)
    app_env: Literal["development", "test", "production"] = Field(default_factory=lambda:"production" if os.getenv("VERCEL")=="1" else "development")
    demo_accounts_enabled: bool = False
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    data_dir: Path = Path(__file__).parents[1] / ".data"
    session_seconds: int = Field(default=3600,ge=300,le=86400)
    max_upload_bytes: int = Field(default_factory=lambda:(4 if os.getenv("VERCEL")=="1" else 10)*1024*1024,ge=1024,le=10 * 1024 * 1024)
    signed_url_seconds: int = Field(default=120,ge=30,le=300)
    supabase_url: str = ""
    supabase_publishable_key: SecretStr = SecretStr("")
    supabase_secret_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = "medora-documents"
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "openai/gpt-oss-120b"
    groq_vision_model: str = "qwen/qwen3.8-27b"
    groq_transcription_model: str = "whisper-large-v3-turbo"
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = "gemini-3.8-flash"
    qdrant_url: str = ""
    qdrant_api_key: SecretStr = SecretStr("")
    qdrant_collection: str = "medora_documents"
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_api_key: SecretStr = SecretStr("")
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = Field(default=384,ge=1,le=65536)

    @property
    def origins(self) -> list[str]:
        return [v.strip().rstrip("/") for v in self.allowed_origins.split(",") if v.strip()]

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key.get_secret_value() and self.supabase_secret_key.get_secret_value())

    @property
    def rag_enabled(self) -> bool:
        return bool(self.qdrant_url and self.qdrant_api_key.get_secret_value())

    @model_validator(mode="after")
    def validate_security(self):
        if not self.origins or "*" in self.origins:
            raise ValueError("Configure explicit ALLOWED_ORIGINS; wildcard credentials are forbidden")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
        supplied = [bool(self.supabase_url), bool(self.supabase_publishable_key.get_secret_value()), bool(self.supabase_secret_key.get_secret_value())]
        if any(supplied) and not all(supplied):
            raise ValueError("Supply all three Supabase settings or none for local development")
        if self.app_env == "production":
            if not self.supabase_enabled or not self.cookie_secure or self.demo_accounts_enabled:
                raise ValueError("Production requires Supabase, secure cookies, and disabled demo accounts")
            for url in [*self.origins, self.supabase_url, self.embedding_base_url, *([self.qdrant_url] if self.qdrant_url else [])]:
                if urlsplit(url).scheme != "https":
                    raise ValueError("Production origins and provider URLs must use HTTPS")
        return self

