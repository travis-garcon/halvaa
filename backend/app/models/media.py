import uuid
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Column, Enum as SAEnum, Integer
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import MediaCategory, MediaProcessingStatus, MediaType

if TYPE_CHECKING:
    from app.models.memorial import Memorial
    from app.models.timeline import TimelineEvent


class MediaAssetBase(SQLModel):
    media_type: MediaType = Field(
        sa_column=Column(
            SAEnum(MediaType, name="media_type", native_enum=False),
            nullable=False,
            index=True,
        ),
    )
    category: MediaCategory = Field(
        default=MediaCategory.GALLERY,
        sa_column=Column(
            SAEnum(MediaCategory, name="media_category", native_enum=False),
            nullable=False,
            index=True,
        ),
    )
    original_storage_key: str = Field(max_length=1024)
    thumbnail_storage_key: Optional[str] = Field(default=None, max_length=1024)
    mime_type: str = Field(max_length=128)
    file_size_bytes: int = Field(ge=0)
    width: Optional[int] = Field(default=None, sa_column=Column(Integer))
    height: Optional[int] = Field(default=None, sa_column=Column(Integer))
    sort_order: int = Field(default=0, index=True)
    processing_status: MediaProcessingStatus = Field(
        default=MediaProcessingStatus.PENDING,
        sa_column=Column(
            SAEnum(MediaProcessingStatus, name="media_processing_status", native_enum=False),
            nullable=False,
            index=True,
        ),
    )


class MediaAsset(UUIDPrimaryKeyMixin, TimestampMixin, MediaAssetBase, table=True):
    __tablename__ = "media_assets"

    translations: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )
    title: Optional[str] = Field(default=None, sa_column=Column(String(length=255), nullable=True))
    description: Optional[str] = Field(default=None, sa_column=Column(String(length=1000), nullable=True))

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)

    memorial: "Memorial" = Relationship(back_populates="media_assets")
    timeline_events: list["TimelineEvent"] = Relationship(back_populates="media")
