from typing import TYPE_CHECKING, Optional

from pydantic import EmailStr
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.collaborator import MemorialCollaborator
    from app.models.guestbook import GuestbookEntry
    from app.models.memorial import Memorial


class UserBase(SQLModel):
    email: EmailStr = Field(index=True, unique=True, max_length=255)
    full_name: str = Field(max_length=255)
    locale: str = Field(default="en", max_length=10)
    avatar_url: Optional[str] = Field(default=None, max_length=2048)
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)


class User(UUIDPrimaryKeyMixin, TimestampMixin, UserBase, table=True):
    __tablename__ = "users"

    external_id: Optional[str] = Field(default=None, index=True, unique=True, max_length=255)
    hashed_password: Optional[str] = Field(default=None, max_length=255)

    memorials_created: list["Memorial"] = Relationship(
        back_populates="created_by",
        sa_relationship_kwargs={"foreign_keys": "Memorial.created_by_id"},
    )
    collaborations: list["MemorialCollaborator"] = Relationship(back_populates="user")
    guestbook_moderations: list["GuestbookEntry"] = Relationship(
        back_populates="moderated_by",
        sa_relationship_kwargs={"foreign_keys": "GuestbookEntry.moderated_by_id"},
    )
