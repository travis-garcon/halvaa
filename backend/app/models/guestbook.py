import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, Enum as SAEnum, String, Text
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import GuestbookStatus

if TYPE_CHECKING:
    from app.models.memorial import Memorial
    from app.models.user import User


class GuestbookEntryBase(SQLModel):
    author_name: str = Field(max_length=255)
    message: str = Field(sa_column=Column(Text, nullable=False))
    tribute_type: str = Field(default="MESSAGE", sa_column=Column(String(length=32), nullable=False, server_default="MESSAGE"))
    relationship_label: Optional[str] = Field(default=None, sa_column=Column(String(length=120), nullable=True))
    status: GuestbookStatus = Field(
        default=GuestbookStatus.PENDING,
        sa_column=Column(
            SAEnum(GuestbookStatus, name="guestbook_status", native_enum=False),
            nullable=False,
            index=True,
        ),
    )


class GuestbookEntry(UUIDPrimaryKeyMixin, TimestampMixin, GuestbookEntryBase, table=True):
    __tablename__ = "guestbook_entries"

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)
    author_user_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        index=True,
    )
    moderated_by_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        index=True,
    )
    moderated_at: Optional[datetime] = Field(default=None)

    memorial: "Memorial" = Relationship(back_populates="guestbook_entries")
    moderated_by: Optional["User"] = Relationship(
        back_populates="guestbook_moderations",
        sa_relationship_kwargs={"foreign_keys": "GuestbookEntry.moderated_by_id"},
    )
