import uuid

from sqlalchemy import func, text
from sqlmodel import Session, select

from app.models.enums import GuestbookStatus, MediaCategory
from app.models.guestbook import GuestbookEntry
from app.models.media import MediaAsset
from app.models.memorial import Memorial
from app.models.timeline import TimelineEvent
from app.models.user import User
from app.schemas.memorial import MemorialProfilePublic, MemorialPublic
from app.schemas.timeline import TimelineEventPublic
from app.services.media_public import media_asset_to_public


def apply_coordinates(memorial: Memorial, latitude: float | None, longitude: float | None) -> None:
    if latitude is not None and longitude is not None:
        from app.services.geo import point_from_lat_lng

        memorial.burial_location = point_from_lat_lng(latitude, longitude)
    elif latitude is None and longitude is None:
        return
    else:
        raise ValueError("Both latitude and longitude are required together")


def memorial_to_public(session: Session, memorial: Memorial) -> MemorialPublic:
    latitude = None
    longitude = None
    if memorial.burial_location is not None:
        row = session.execute(
            text(
                """
                SELECT
                    ST_Y(burial_location::geometry) AS latitude,
                    ST_X(burial_location::geometry) AS longitude
                FROM memorials
                WHERE id = :memorial_id
                """
            ),
            {"memorial_id": memorial.id},
        ).mappings().first()
        if row:
            latitude = float(row["latitude"])
            longitude = float(row["longitude"])

    last_reviewed_by_name = None
    if memorial.last_reviewed_by_id is not None:
        reviewer = session.get(User, memorial.last_reviewed_by_id)
        if reviewer is not None:
            last_reviewed_by_name = reviewer.full_name

    return MemorialPublic(
        id=memorial.id,
        public_id=memorial.public_id,
        slug=memorial.slug,
        status=memorial.status,
        birth_date=memorial.birth_date,
        death_date=memorial.death_date,
        burial_address=memorial.burial_address,
        burial_site_name=memorial.burial_site_name,
        burial_plot_name=memorial.burial_plot_name,
        qr_code_url=memorial.qr_code_url,
        translations=memorial.translations,
        theme_overrides=memorial.theme_overrides,
        family_tree=memorial.family_tree,
        latitude=latitude,
        longitude=longitude,
        created_at=memorial.created_at,
        updated_at=memorial.updated_at,
        published_at=memorial.published_at,
        featured_at=memorial.featured_at,
        last_reviewed_at=memorial.last_reviewed_at,
        last_review_decision=memorial.last_review_decision,
        last_reviewed_by_id=memorial.last_reviewed_by_id,
        last_reviewed_by_name=last_reviewed_by_name,
    )


def memorial_to_profile_public(session: Session, memorial: Memorial) -> MemorialProfilePublic:
    base = memorial_to_public(session, memorial)

    timeline_rows = session.exec(
        select(TimelineEvent)
        .where(TimelineEvent.memorial_id == memorial.id)
        .order_by(TimelineEvent.sort_order.asc(), TimelineEvent.event_date.asc())
    ).all()

    media_by_id: dict[uuid.UUID, MediaAsset] = {}
    media_ids = {event.media_id for event in timeline_rows if event.media_id}
    if media_ids:
        assets = session.exec(select(MediaAsset).where(MediaAsset.id.in_(media_ids))).all()
        media_by_id = {asset.id: asset for asset in assets}

    timeline_events: list[TimelineEventPublic] = []
    for event in timeline_rows:
        thumb_url = None
        if event.media_id and event.media_id in media_by_id:
            thumb_url = media_asset_to_public(media_by_id[event.media_id]).thumbnail_url
        timeline_events.append(
            TimelineEventPublic(
                id=event.id,
                event_type=event.event_type,
                sort_order=event.sort_order,
                event_date=event.event_date,
                translations=event.translations,
                media_id=event.media_id,
                thumbnail_url=thumb_url,
            )
        )

    gallery_assets = session.exec(
        select(MediaAsset)
        .where(
            MediaAsset.memorial_id == memorial.id,
            MediaAsset.category.in_([MediaCategory.GALLERY, MediaCategory.AVATAR, MediaCategory.TIMELINE]),
        )
        .order_by(MediaAsset.sort_order.asc(), MediaAsset.created_at.desc())
    ).all()

    document_assets = session.exec(
        select(MediaAsset)
        .where(
            MediaAsset.memorial_id == memorial.id,
            MediaAsset.category.in_([MediaCategory.DOCUMENT, MediaCategory.WILL]),
        )
        .order_by(MediaAsset.sort_order.asc(), MediaAsset.created_at.desc())
    ).all()

    all_assets = session.exec(
        select(MediaAsset)
        .where(MediaAsset.memorial_id == memorial.id)
        .order_by(MediaAsset.sort_order.asc(), MediaAsset.created_at.desc())
    ).all()
    artifact_assets = [
        asset
        for asset in all_assets
        if isinstance(asset.translations, dict)
        and isinstance(asset.translations.get("meta"), dict)
        and asset.translations.get("meta", {}).get("asset_kind") == "ARTIFACT"
    ]

    guestbook_count = session.exec(
        select(func.count())
        .select_from(GuestbookEntry)
        .where(
            GuestbookEntry.memorial_id == memorial.id,
            GuestbookEntry.status == GuestbookStatus.APPROVED,
        )
    ).one()

    return MemorialProfilePublic(
        **base.model_dump(),
        timeline_events=timeline_events,
        gallery=[media_asset_to_public(asset) for asset in gallery_assets],
        documents=[media_asset_to_public(asset) for asset in document_assets],
        artifacts=[media_asset_to_public(asset) for asset in artifact_assets],
        guestbook_approved_count=int(guestbook_count),
    )
