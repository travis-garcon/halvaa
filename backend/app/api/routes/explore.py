from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.deps import get_db
from app.schemas.explore import ExploreMemorialFeed, GeoJSONFeatureCollection
from app.services.geo import fetch_discovery_memorials, fetch_nearby_memorials

router = APIRouter(prefix="/explore", tags=["explore"])


@router.get("/nearby", response_model=GeoJSONFeatureCollection)
def nearby_memorials(
    session: Annotated[Session, Depends(get_db)],
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(default=5000, ge=100, le=100_000),
    locale: str = Query(default="en", max_length=10),
) -> GeoJSONFeatureCollection:
    return fetch_nearby_memorials(
        session,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        locale=locale,
    )


@router.get("/discover", response_model=ExploreMemorialFeed)
def discover_memorials(
    session: Annotated[Session, Depends(get_db)],
    kind: str = Query(default="featured", pattern="^(featured|latest|updated)$"),
    locale: str = Query(default="en", max_length=10),
    limit: int = Query(default=12, ge=1, le=24),
) -> ExploreMemorialFeed:
    return fetch_discovery_memorials(session, kind=kind, locale=locale, limit=limit)
