import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Optional

from geoalchemy2 import Geography
from sqlalchemy import BigInteger, Column, Date, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import MemorialStatus

if TYPE_CHECKING:
    from app.models.collaborator import MemorialCollaborator
    from app.models.guestbook import GuestbookEntry
    from app.models.media import MediaAsset
    from app.models.timeline import TimelineEvent
    from app.models.user import User


class MemorialBase(SQLModel):
    public_id: str = Field(index=True, unique=True, max_length=64)
    slug: str = Field(index=True, unique=True, max_length=128)
    status: MemorialStatus = Field(
        default=MemorialStatus.DRAFT,
        sa_column=Column(
            SAEnum(MemorialStatus, name="memorial_status", native_enum=False),
            nullable=False,
            index=True,
        ),
    )
    birth_date: Optional[date] = Field(default=None, sa_column=Column(Date))
    death_date: Optional[date] = Field(default=None, sa_column=Column(Date))
    burial_address: Optional[str] = Field(default=None, max_length=512)
    burial_site_name: Optional[str] = Field(default=None, max_length=255)
    burial_plot_name: Optional[str] = Field(default=None, max_length=255)
    qr_code_url: Optional[str] = Field(default=None, max_length=2048)
    published_at: Optional[datetime] = Field(default=None)
    featured_at: Optional[datetime] = Field(default=None)
    last_reviewed_at: Optional[datetime] = Field(default=None)
    last_review_decision: Optional[str] = Field(default=None, sa_column=Column(String(length=32), nullable=True))
    family_tree: list[dict[str, str]] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    category: Optional[str] = Field(default=None, max_length=80, index=True)
    meta: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"))
    filter_tags: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    is_verified: bool = Field(default=False, index=True)
    verified_at: Optional[datetime] = Field(default=None)
    view_count: int = Field(
        default=0,
        sa_column=Column(BigInteger, nullable=False, server_default="0", index=True),
    )
    locations: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))


class Memorial(UUIDPrimaryKeyMixin, TimestampMixin, MemorialBase, table=True):
    __tablename__ = "memorials"

    translations: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )
    theme_overrides: dict[str, str] = Field(
        default_factory=lambda: {"--color-primary": "#FF6B00"},
        sa_column=Column(JSONB, nullable=False, server_default='{"--color-primary": "#FF6B00"}'),
    )
    burial_location: Optional[Any] = Field(
        default=None,
        sa_column=Column(Geography(geometry_type="POINT", srid=4326), nullable=True),
    )

    created_by_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    last_reviewed_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", index=True)

    created_by: "User" = Relationship(
        back_populates="memorials_created",
        sa_relationship_kwargs={"foreign_keys": "Memorial.created_by_id"},
    )
    collaborators: list["MemorialCollaborator"] = Relationship(back_populates="memorial")
    timeline_events: list["TimelineEvent"] = Relationship(back_populates="memorial")
    guestbook_entries: list["GuestbookEntry"] = Relationship(back_populates="memorial")
    media_assets: list["MediaAsset"] = Relationship(back_populates="memorial")
