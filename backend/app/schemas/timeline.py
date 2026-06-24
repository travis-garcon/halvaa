from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import TimelineEventType


class TimelineEventPublic(BaseModel):
    id: UUID
    event_type: TimelineEventType
    sort_order: int
    event_date: date | None
    translations: dict[str, Any]
    media_id: UUID | None = None
    thumbnail_url: str | None = None

    model_config = {"from_attributes": True}


class TimelineEventCreate(BaseModel):
    event_type: TimelineEventType
    sort_order: int = 0
    event_date: date | None = None
    translations: dict[str, Any] = Field(default_factory=dict)
    media_id: UUID | None = None


class TimelineEventUpdate(BaseModel):
    event_type: TimelineEventType | None = None
    sort_order: int | None = None
    event_date: date | None = None
    translations: dict[str, Any] | None = None
    media_id: UUID | None = None
