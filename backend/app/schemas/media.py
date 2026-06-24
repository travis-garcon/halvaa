from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import MediaCategory, MediaProcessingStatus, MediaType


class MediaPublic(BaseModel):
    id: UUID
    media_type: MediaType
    category: MediaCategory
    mime_type: str
    file_size_bytes: int
    width: int | None
    height: int | None
    sort_order: int
    processing_status: MediaProcessingStatus
    translations: dict[str, dict[str, str]]
    title: str | None = None
    description: str | None = None
    original_url: str
    thumbnail_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaUpdate(BaseModel):
    category: MediaCategory | None = None
    sort_order: int | None = None
    translations: dict[str, dict[str, str]] | None = None
    title: str | None = None
    description: str | None = None
