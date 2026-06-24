import uuid
from typing import Optional

from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class ReviewEventBase(SQLModel):
    kind: str = Field(sa_column=Column(String(length=32), nullable=False, index=True))
    decision: str = Field(sa_column=Column(String(length=32), nullable=False))
    subject_name: Optional[str] = Field(default=None, sa_column=Column(String(length=255), nullable=True))


class ReviewEvent(UUIDPrimaryKeyMixin, TimestampMixin, ReviewEventBase, table=True):
    __tablename__ = "review_events"

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)
    reviewer_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", index=True)
    guestbook_entry_id: Optional[uuid.UUID] = Field(default=None, foreign_key="guestbook_entries.id", index=True)
