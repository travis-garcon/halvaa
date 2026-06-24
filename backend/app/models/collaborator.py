import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.models.enums import CollaboratorRole

if TYPE_CHECKING:
    from app.models.memorial import Memorial
    from app.models.user import User


class MemorialCollaboratorBase(SQLModel):
    role: CollaboratorRole = Field(default=CollaboratorRole.EDITOR, index=True)
    invited_at: datetime = Field(default_factory=utc_now, nullable=False)
    accepted_at: Optional[datetime] = Field(default=None)


class MemorialCollaborator(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    MemorialCollaboratorBase,
    table=True,
):
    __tablename__ = "memorial_collaborators"
    __table_args__ = (
        UniqueConstraint("memorial_id", "user_id", name="uq_memorial_collaborator"),
    )

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)

    memorial: "Memorial" = Relationship(back_populates="collaborators")
    user: "User" = Relationship(back_populates="collaborations")
