from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_db
from app.models.memorial import Memorial
from app.models.enums import MediaCategory
from app.models.media import MediaAsset
from app.models.store import LandingMemorialPlacement
from app.schemas.explore import ExploreMemorialCard, ExploreMemorialFeed, GeoJSONFeatureCollection, LandingMemorialCategory, LandingMemorialFeed
from app.services.geo import fetch_discovery_memorials, fetch_nearby_memorials
from app.services.media_public import media_asset_is_available, media_asset_to_public

router = APIRouter(prefix="/explore", tags=["explore"])


@router.get("/nearby", response_model=GeoJSONFeatureCollection)
def nearby_memorials(
    session: Annotated[Session, Depends(get_db)],
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(default=5000, ge=100, le=100_000),
    locale: str = Query(default="en", max_length=10),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=30, ge=1, le=30),
) -> GeoJSONFeatureCollection:
    return fetch_nearby_memorials(
        session,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        locale=locale,
        q=q,
        limit=limit,
    )


@router.get("/discover", response_model=ExploreMemorialFeed)
def discover_memorials(
    session: Annotated[Session, Depends(get_db)],
    kind: str = Query(default="featured", pattern="^(featured|latest|updated)$"),
    locale: str = Query(default="en", max_length=10),
    limit: int = Query(default=30, ge=1, le=30),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=120),
) -> ExploreMemorialFeed:
    return fetch_discovery_memorials(session, kind=kind, locale=locale, limit=limit, offset=offset, q=q)


def _card_from_memorial(session: Session, memorial: Memorial, locale: str) -> ExploreMemorialCard:
    name = (
        memorial.translations.get(locale, {}).get("name")
        or memorial.translations.get("en", {}).get("name")
        or next((layer.get("name") for layer in memorial.translations.values() if isinstance(layer, dict) and layer.get("name")), None)
        or memorial.slug
    )
    image_assets = session.exec(
        select(MediaAsset)
        .where(
            MediaAsset.memorial_id == memorial.id,
            MediaAsset.category.in_([MediaCategory.AVATAR, MediaCategory.GALLERY]),
        )
        .order_by(MediaAsset.category.asc(), MediaAsset.sort_order.asc(), MediaAsset.created_at.asc())
    ).all()
    image_assets = [asset for asset in image_assets if media_asset_is_available(asset)]
    image_asset = next(
        (
            asset
            for asset in image_assets
            if isinstance(asset.translations, dict)
            and isinstance(asset.translations.get("meta"), dict)
            and asset.translations["meta"].get("header_role") == "portrait"
        ),
        None,
    ) or next((asset for asset in image_assets if asset.category == MediaCategory.AVATAR), None) or (image_assets[0] if image_assets else None)
    image_url = None
    if image_asset:
        public_asset = media_asset_to_public(image_asset)
        image_url = public_asset.thumbnail_url or public_asset.original_url
    return ExploreMemorialCard(
        id=memorial.id,
        slug=memorial.slug,
        name=name,
        status=memorial.status.value,
        birth_date=memorial.birth_date,
        death_date=memorial.death_date,
        burial_address=memorial.burial_address,
        burial_site_name=memorial.burial_site_name,
        burial_plot_name=memorial.burial_plot_name,
        category=memorial.category,
        metadata=memorial.meta,
        filter_tags=memorial.filter_tags,
        created_at=memorial.created_at,
        updated_at=memorial.updated_at,
        published_at=memorial.published_at,
        featured_at=memorial.featured_at,
        image_url=image_url,
        is_verified=memorial.is_verified,
        view_count=memorial.view_count,
    )


@router.get("/landing", response_model=LandingMemorialFeed)
def landing_memorials(
    session: Annotated[Session, Depends(get_db)],
    locale: str = Query(default="en", max_length=10),
) -> LandingMemorialFeed:
    rows = session.exec(
        select(LandingMemorialPlacement, Memorial)
        .join(Memorial, Memorial.id == LandingMemorialPlacement.memorial_id)
        .where(LandingMemorialPlacement.is_active == True)
        .order_by(LandingMemorialPlacement.category.asc(), LandingMemorialPlacement.sort_order.asc())
    ).all()
    grouped: dict[str, LandingMemorialCategory] = {}
    for placement, memorial in rows:
        category = grouped.setdefault(
            placement.category,
            LandingMemorialCategory(category=placement.category, label=placement.label, items=[]),
        )
        category.items.append(_card_from_memorial(session, memorial, locale))
    return LandingMemorialFeed(categories=list(grouped.values()))
