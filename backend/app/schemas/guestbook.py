from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from typing import Literal

from app.models.enums import GuestbookStatus
from app.schemas.validators import SanitizedStr


class GuestbookCreate(BaseModel):
    author_name: SanitizedStr = Field(min_length=1, max_length=255)
    message: SanitizedStr = Field(min_length=1, max_length=4000)
    tribute_type: Literal["MESSAGE", "TRIBUTE", "PRAYER", "POEM"] = "MESSAGE"
    relationship_label: SanitizedStr | None = Field(default=None, max_length=120)


class GuestbookModerate(BaseModel):
    status: Literal[GuestbookStatus.APPROVED, GuestbookStatus.REJECTED]


class GuestbookPublic(BaseModel):
    id: UUID
    author_name: str
    message: str
    tribute_type: str
    relationship_label: str | None = None
    status: GuestbookStatus
    created_at: datetime
    moderated_at: datetime | None = None
    moderated_by_id: UUID | None = None
    moderated_by_name: str | None = None

    model_config = {"from_attributes": True}


class GuestbookQueueItem(GuestbookPublic):
    memorial_id: UUID
    memorial_slug: str
    memorial_name: str | None = None
