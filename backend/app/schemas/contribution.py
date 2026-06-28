from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.validators import SanitizedStr


class ContributionCreate(BaseModel):
    contribution_type: Literal["PROFILE_TEXT"] = "PROFILE_TEXT"
    locale: SanitizedStr = Field(default="en", max_length=10)
    name: SanitizedStr | None = Field(default=None, max_length=255)
    biography: SanitizedStr | None = Field(default=None, max_length=4000)
    epitaph: SanitizedStr | None = Field(default=None, max_length=1000)
    source_note: SanitizedStr | None = Field(default=None, max_length=1000)


class ContributionReview(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    reviewer_note: SanitizedStr | None = Field(default=None, max_length=1000)


class ContributionPublic(BaseModel):
    id: UUID
    memorial_id: UUID
    contributor_id: UUID
    contributor_name: str | None = None
    reviewed_by_id: UUID | None = None
    contribution_type: str
    status: str
    payload: dict[str, Any]
    reviewer_note: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
