import json
import uuid
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import text
from sqlmodel import Session, select

from app.models.enums import MemorialStatus
from app.models.media import MediaAsset
from app.models.enums import MediaCategory
from app.schemas.explore import ExploreMemorialCard, ExploreMemorialFeed, GeoJSONFeature, GeoJSONFeatureCollection, NearbyMemorialProperties
from app.services.media_public import media_asset_is_available, media_asset_to_public


def point_from_lat_lng(latitude: float, longitude: float) -> WKTElement:
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)


def memorial_to_public_coords(memorial: Any) -> tuple[float | None, float | None]:
    if memorial.burial_location is None:
        return None, None
    # Coordinates are resolved at query/serialization time for API responses.
    return None, None


def fetch_nearby_memorials(
    session: Session,
    latitude: float,
    longitude: float,
    radius_m: int,
    locale: str = "en",
    q: str | None = None,
    limit: int = 30,
) -> GeoJSONFeatureCollection:
    search_sql = ""
    normalized_query = (q or "").strip()
    if normalized_query:
        search_sql = """
          AND (
            m.slug ILIKE :search
            OR COALESCE(m.burial_site_name, '') ILIKE :search
            OR COALESCE(m.burial_plot_name, '') ILIKE :search
            OR m.translations::text ILIKE :search
          )
        """

    query = text(
        f"""
        SELECT
            m.id,
            m.slug,
            m.status,
            m.is_verified,
            m.view_count,
            m.translations,
            m.burial_site_name,
            m.burial_plot_name,
            ST_AsGeoJSON(m.burial_location)::json AS geometry,
            ST_Distance(
                m.burial_location::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
            ) AS distance_m
        FROM memorials m
        WHERE m.status IN (:published, :featured)
          AND m.burial_location IS NOT NULL
          AND ST_DWithin(
                m.burial_location::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radius_m
          )
          {search_sql}
        ORDER BY distance_m ASC
        LIMIT :limit
        """
    )
    params: dict[str, Any] = {
        "lat": latitude,
        "lng": longitude,
        "radius_m": radius_m,
        "published": MemorialStatus.PUBLISHED.value,
        "featured": MemorialStatus.FEATURED.value,
        "limit": limit,
    }
    if normalized_query:
        params["search"] = f"%{normalized_query}%"
    rows = session.execute(query, params).mappings().all()

    features: list[GeoJSONFeature] = []
    for row in rows:
        translations = row["translations"] or {}
        locale_layer = translations.get(locale) or translations.get("en") or {}
        image_assets = session.exec(
            select(MediaAsset)
            .where(
                MediaAsset.memorial_id == uuid.UUID(str(row["id"])),
                MediaAsset.category.in_([MediaCategory.AVATAR, MediaCategory.GALLERY]),
            )
            .order_by(MediaAsset.sort_order.asc(), MediaAsset.created_at.asc())
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
        properties = NearbyMemorialProperties(
            id=uuid.UUID(str(row["id"])),
            slug=row["slug"],
            name=locale_layer.get("name"),
            distance_m=float(row["distance_m"]),
            burial_site_name=row["burial_site_name"],
            burial_plot_name=row["burial_plot_name"],
            image_url=image_url,
            status=row["status"],
            is_verified=bool(row["is_verified"]),
            view_count=int(row["view_count"] or 0),
        )
        geometry = row["geometry"]
        if isinstance(geometry, str):
            geometry = json.loads(geometry)
        features.append(
            GeoJSONFeature(
                geometry=geometry,
                properties=properties.model_dump(mode="json"),
            )
        )

    return GeoJSONFeatureCollection(features=features)


def fetch_discovery_memorials(
    session: Session,
    kind: str,
    locale: str = "en",
    limit: int = 30,
    offset: int = 0,
    q: str | None = None,
) -> ExploreMemorialFeed:
    order_sql = {
        "featured": "m.featured_at DESC NULLS LAST, m.updated_at DESC",
        "latest": "m.published_at DESC NULLS LAST, m.created_at DESC",
        "updated": "m.updated_at DESC, m.created_at DESC",
    }.get(kind, "m.updated_at DESC, m.created_at DESC")

    search_sql = ""
    normalized_query = (q or "").strip()
    if normalized_query:
        search_sql = """
          AND (
            m.slug ILIKE :search
            OR COALESCE(m.category, '') ILIKE :search
            OR m.translations::text ILIKE :search
            OR m.metadata::text ILIKE :search
            OR m.filter_tags::text ILIKE :search
          )
        """

    count_query = text(
        f"""
        SELECT COUNT(*) AS total
        FROM memorials m
        WHERE m.status IN (:published, :featured)
        {"AND m.status = :featured_only" if kind == "featured" else ""}
        {search_sql}
        """
    )

    query = text(
        f"""
        SELECT
            m.id,
            m.slug,
            m.status,
            m.is_verified,
            m.view_count,
            m.birth_date,
            m.death_date,
            m.burial_address,
            m.burial_site_name,
            m.burial_plot_name,
            m.category,
            m.metadata,
            m.filter_tags,
            m.created_at,
            m.updated_at,
            m.published_at,
            m.featured_at,
            m.translations,
            ST_Y(m.burial_location::geometry) AS latitude,
            ST_X(m.burial_location::geometry) AS longitude
        FROM memorials m
        WHERE m.status IN (:published, :featured)
        {"AND m.status = :featured_only" if kind == "featured" else ""}
        {search_sql}
        ORDER BY {order_sql}
        LIMIT :limit
        OFFSET :offset
        """
    )
    params: dict[str, Any] = {
        "published": MemorialStatus.PUBLISHED.value,
        "featured": MemorialStatus.FEATURED.value,
        "limit": limit,
        "offset": offset,
    }
    if kind == "featured":
        params["featured_only"] = MemorialStatus.FEATURED.value
    if normalized_query:
        params["search"] = f"%{normalized_query}%"

    total = int(session.execute(count_query, params).scalar_one())
    rows = session.execute(query, params).mappings().all()

    items: list[ExploreMemorialCard] = []
    for row in rows:
        translations = row["translations"] or {}
        locale_layer = translations.get(locale) or translations.get("en") or next(iter(translations.values()), {})
        image_assets = session.exec(
            select(MediaAsset)
            .where(
                MediaAsset.memorial_id == uuid.UUID(str(row["id"])),
                MediaAsset.category.in_([MediaCategory.AVATAR, MediaCategory.GALLERY]),
            )
            .order_by(MediaAsset.sort_order.asc(), MediaAsset.created_at.asc())
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
        items.append(
            ExploreMemorialCard(
                id=uuid.UUID(str(row["id"])),
                slug=row["slug"],
                name=locale_layer.get("name") or row["slug"],
                status=row["status"],
                birth_date=row["birth_date"],
                death_date=row["death_date"],
                burial_address=row["burial_address"],
                burial_site_name=row["burial_site_name"],
                burial_plot_name=row["burial_plot_name"],
                category=row["category"],
                metadata=row["metadata"] or {},
                filter_tags=row["filter_tags"] or {},
                latitude=float(row["latitude"]) if row["latitude"] is not None else None,
                longitude=float(row["longitude"]) if row["longitude"] is not None else None,
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                published_at=row["published_at"],
                featured_at=row["featured_at"],
                image_url=image_url,
                is_verified=bool(row["is_verified"]),
                view_count=int(row["view_count"] or 0),
            )
        )

    return ExploreMemorialFeed(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )
