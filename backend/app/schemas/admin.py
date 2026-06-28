from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AdminKpis(BaseModel):
    users: int
    memorials: int
    published_memorials: int
    guestbook_entries: int
    income_usd_cents: int
    income_irr: int


class LandingPlacementCreate(BaseModel):
    memorial_id: UUID
    category: str = "featured"
    sort_order: int = 0
    label: str | None = None
    is_active: bool = True


class LandingPlacementPublic(LandingPlacementCreate):
    id: UUID
    memorial_slug: str
    memorial_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
