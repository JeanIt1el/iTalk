from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from the backend environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "iTalk API"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"

    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_key: str = Field(default="", validation_alias="SUPABASE_KEY")
    supabase_anon_key: str = Field(default="", validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(
        default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY"
    )

    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", validation_alias="GROQ_MODEL")
    groq_temperature: float = Field(default=0.7, ge=0.0, le=2.0)

    frontend_origin: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_ORIGIN")
    access_token_expire_minutes: int = Field(default=60, ge=1, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)


@lru_cache

def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
