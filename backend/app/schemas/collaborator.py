from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.enums import CollaboratorRole


class MemorialCollaboratorInvite(BaseModel):
    email: EmailStr
    role: CollaboratorRole


class MemorialCollaboratorUpdate(BaseModel):
    role: CollaboratorRole


class MemorialCollaboratorPublic(BaseModel):
    id: UUID
    user_id: UUID
    memorial_id: UUID | None = None
    memorial_slug: str | None = None
    memorial_name: str | None = None
    full_name: str
    email: EmailStr
    role: CollaboratorRole
    invited_at: datetime
    accepted_at: datetime | None = None


class MemorialCollaboratorList(BaseModel):
    items: list[MemorialCollaboratorPublic]
