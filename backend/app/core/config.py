from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = "postgresql://halvaa:halvaa@localhost:5432/halvaa"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-production"
    environment: Literal["development", "staging", "production"] = "development"

    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
    )
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    upload_dir: str = "uploads"
    max_image_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 100 * 1024 * 1024
    max_document_bytes: int = 25 * 1024 * 1024
    thumbnail_max_dimension: int = 400

    rate_limit_auth: str = "10/minute"
    rate_limit_upload: str = "20/hour"
    rate_limit_guestbook: str = "5/minute"
    rate_limit_default: str = "120/minute"

    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5
    sms_provider: str = "kavenegar"
    sms_api_key: str | None = None
    sms_sender: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@halvaa.app"
    smtp_from_name: str = "Halvaa"
    smtp_use_tls: bool = True
    smtp_helo_domain: str = "halvaa.app"
    smtp_direct_delivery: bool = True

    stripe_secret_key: str | None = None
    stripe_success_url: str = "http://localhost:3000/en/store?payment=success"
    stripe_cancel_url: str = "http://localhost:3000/en/store?payment=cancel"
    zarinpal_merchant_id: str | None = None
    zarinpal_callback_url: str = "http://localhost:3000/fa/store?payment=verify"
    zarinpal_sandbox: bool = True

    mapbox_access_token: str | None = None

    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_callback_url: str = "http://localhost:8000/api/v1/auth/google/callback"
    google_post_login_url: str = "http://localhost:3000/en/profile"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment == "production" and self.secret_key == "change-me-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a strong value when ENVIRONMENT=production",
            )
        if self.environment == "production" and any("localhost" in origin or "127.0.0.1" in origin for origin in self.cors_origins):
            raise ValueError(
                "CORS_ORIGINS must not use localhost values when ENVIRONMENT=production",
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
