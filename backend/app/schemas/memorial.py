from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import MemorialStatus
from app.schemas.media import MediaPublic
from app.schemas.timeline import TimelineEventPublic
from app.schemas.validators import Latitude, Longitude, SanitizedStr, SlugStr


class MemorialCreate(BaseModel):
    slug: SlugStr | None = None
    birth_date: date | None = None
    death_date: date | None = None
    burial_address: SanitizedStr | None = Field(default=None, max_length=512)
    burial_site_name: SanitizedStr | None = Field(default=None, max_length=255)
    burial_plot_name: SanitizedStr | None = Field(default=None, max_length=255)
    qr_code_url: SanitizedStr | None = Field(default=None, max_length=2048)
    translations: dict[str, dict[str, SanitizedStr]] = Field(default_factory=dict)
    theme_overrides: dict[str, SanitizedStr] = Field(
        default_factory=lambda: {"--color-primary": "#FF6B00"},
    )
    family_tree: list[dict[str, SanitizedStr]] = Field(default_factory=list)
    latitude: Latitude | None = None
    longitude: Longitude | None = None


class MemorialUpdate(BaseModel):
    birth_date: date | None = None
    death_date: date | None = None
    burial_address: SanitizedStr | None = Field(default=None, max_length=512)
    burial_site_name: SanitizedStr | None = Field(default=None, max_length=255)
    burial_plot_name: SanitizedStr | None = Field(default=None, max_length=255)
    qr_code_url: SanitizedStr | None = Field(default=None, max_length=2048)
    translations: dict[str, dict[str, SanitizedStr]] | None = None
    theme_overrides: dict[str, SanitizedStr] | None = None
    family_tree: list[dict[str, SanitizedStr]] | None = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    status: MemorialStatus | None = None


class MemorialPublic(BaseModel):
    id: UUID
    public_id: str
    slug: str
    status: MemorialStatus
    birth_date: date | None
    death_date: date | None
    burial_address: str | None
    burial_site_name: str | None = None
    burial_plot_name: str | None = None
    qr_code_url: str | None = None
    translations: dict[str, Any]
    theme_overrides: dict[str, str]
    family_tree: list[dict[str, str]] = Field(default_factory=list)
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None
    featured_at: datetime | None = None
    last_reviewed_at: datetime | None = None
    last_review_decision: str | None = None
    last_reviewed_by_id: UUID | None = None
    last_reviewed_by_name: str | None = None

    model_config = {"from_attributes": True}


class MemorialStatusUpdate(BaseModel):
    status: MemorialStatus


class MemorialReviewUpdate(BaseModel):
    decision: Literal["APPROVE", "REQUEST_CHANGES", "FEATURE"]


class MemorialApprovalQueueItem(BaseModel):
    id: UUID
    slug: str
    status: MemorialStatus
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None = None
    published_at: datetime | None = None
    memorial_name: str | None = None
    submitted_by_name: str | None = None
    last_reviewed_at: datetime | None = None
    last_review_decision: str | None = None
    last_reviewed_by_name: str | None = None


class MemorialReviewActivityItem(BaseModel):
    kind: Literal["MEMORIAL_REVIEW", "GUESTBOOK_MODERATION"]
    created_at: datetime
    reviewer_name: str | None = None
    decision: str
    subject_name: str | None = None


class MemorialProfilePublic(MemorialPublic):
    """Unified public profile payload for memorial detail pages."""

    timeline_events: list[TimelineEventPublic] = Field(default_factory=list)
    gallery: list[MediaPublic] = Field(default_factory=list)
    documents: list[MediaPublic] = Field(default_factory=list)
    artifacts: list[MediaPublic] = Field(default_factory=list)
    guestbook_approved_count: int = 0
