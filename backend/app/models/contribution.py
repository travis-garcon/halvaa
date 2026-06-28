import uuid
from typing import Any

from sqlalchemy import Column, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class MemorialContribution(UUIDPrimaryKeyMixin, TimestampMixin, table=True):
    __tablename__ = "memorial_contributions"

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)
    contributor_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    reviewed_by_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    contribution_type: str = Field(default="PROFILE_TEXT", max_length=48, index=True)
    status: str = Field(default="PENDING", sa_column=Column(String(length=24), nullable=False, index=True))
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    reviewer_note: str | None = Field(default=None, max_length=1000)
