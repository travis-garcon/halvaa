from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.validators import SanitizedStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: SanitizedStr = Field(min_length=1, max_length=255)
    locale: SanitizedStr = Field(default="en", max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class OtpStartRequest(BaseModel):
    identifier: SanitizedStr | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    full_name: SanitizedStr | None = Field(default=None, max_length=255)
    locale: SanitizedStr = Field(default="en", max_length=10)
    phone_number: SanitizedStr | None = Field(default=None, max_length=32)


class OtpStartResponse(BaseModel):
    otp_id: UUID
    delivery_provider: str
    expires_in_seconds: int
    is_new_user: bool
    debug_code: str | None = None


class OtpVerifyRequest(BaseModel):
    otp_id: UUID
    code: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    locale: str
    avatar_url: str | None = None
    phone_number: str | None = None
    address: str | None = None
    profile_completed: bool = True
    locked_email: bool = True
    locked_phone_number: bool = False
    profile_completion_percent: int = 0
    missing_profile_fields: list[str] = Field(default_factory=list)
    entitlements: dict[str, int] = Field(default_factory=dict)
    is_superuser: bool = False
    role: str = "USER"

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: SanitizedStr | None = Field(default=None, min_length=1, max_length=255)
    locale: SanitizedStr | None = Field(default=None, max_length=10)
    avatar_url: SanitizedStr | None = Field(default=None, max_length=2048)
    email: EmailStr | None = None
    phone_number: SanitizedStr | None = Field(default=None, max_length=32)
    address: SanitizedStr | None = Field(default=None, max_length=512)
