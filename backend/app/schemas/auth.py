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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    locale: str
    avatar_url: str | None = None
    is_superuser: bool = False

    model_config = {"from_attributes": True}
