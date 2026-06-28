import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class AuthOtp(UUIDPrimaryKeyMixin, TimestampMixin, table=True):
    __tablename__ = "auth_otps"

    email: str = Field(index=True, max_length=255)
    code_hash: str = Field(max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    locale: str = Field(default="en", max_length=10)
    phone_number: str | None = Field(default=None, max_length=32)
    sms_provider: str | None = Field(default=None, max_length=64)
    expires_at: datetime = Field(nullable=False, index=True)
    consumed_at: datetime | None = Field(default=None, index=True)
    attempts: int = Field(default=0)
    requested_by_ip: str | None = Field(default=None, max_length=64)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
