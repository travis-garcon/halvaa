from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.validators import Latitude, Longitude


class NearbyQuery(BaseModel):
    latitude: Latitude
    longitude: Longitude
    radius_m: int = Field(default=5000, ge=100, le=100_000)


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoJSONFeature]


class NearbyMemorialProperties(BaseModel):
    id: UUID
    slug: str
    name: str | None = None
    distance_m: float
    burial_site_name: str | None = None
    burial_plot_name: str | None = None
    image_url: str | None = None
    status: str = "PUBLISHED"
    is_verified: bool = False
    view_count: int = 0


class ExploreMemorialCard(BaseModel):
    id: UUID
    slug: str
    name: str
    status: str
    birth_date: date | None = None
    death_date: date | None = None
    burial_address: str | None = None
    burial_site_name: str | None = None
    burial_plot_name: str | None = None
    category: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    filter_tags: dict[str, Any] = Field(default_factory=dict)
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None
    featured_at: datetime | None = None
    image_url: str | None = None
    is_verified: bool = False
    view_count: int = 0


class ExploreMemorialFeed(BaseModel):
    items: list[ExploreMemorialCard]
    total: int = 0
    limit: int = 30
    offset: int = 0
    has_more: bool = False


class LandingMemorialCategory(BaseModel):
    category: str
    label: str | None = None
    items: list[ExploreMemorialCard]


class LandingMemorialFeed(BaseModel):
    categories: list[LandingMemorialCategory]
