from pathlib import Path
from urllib.parse import urlencode

from app.models.media import MediaAsset
from app.schemas.media import MediaPublic


def media_asset_to_public(asset: MediaAsset) -> MediaPublic:
    original_key = asset.original_storage_key
    if original_key.startswith(("http://", "https://")):
        original_url = original_key
        thumbnail_url = asset.thumbnail_storage_key if asset.thumbnail_storage_key and asset.thumbnail_storage_key.startswith(("http://", "https://")) else None
        return MediaPublic(
            id=asset.id,
            media_type=asset.media_type,
            category=asset.category,
            mime_type=asset.mime_type,
            file_size_bytes=asset.file_size_bytes,
            width=asset.width,
            height=asset.height,
            sort_order=asset.sort_order,
            processing_status=asset.processing_status,
            translations=asset.translations,
            title=asset.title,
            description=asset.description,
            original_url=original_url,
            thumbnail_url=thumbnail_url,
            created_at=asset.created_at,
        )
    original_stem = Path(original_key).as_posix()
    if "uploads/" in original_stem:
        original_stem = original_stem.split("uploads/", 1)[1]
    version_query = urlencode({"v": int(asset.updated_at.timestamp())})
    original_url = f"/uploads/{original_stem}?{version_query}"
    thumbnail_url = None
    if asset.thumbnail_storage_key:
        thumb_stem = Path(asset.thumbnail_storage_key).as_posix()
        if "uploads/" in thumb_stem:
            thumb_stem = thumb_stem.split("uploads/", 1)[1]
        thumbnail_url = f"/uploads/{thumb_stem}?{version_query}"
    return MediaPublic(
        id=asset.id,
        media_type=asset.media_type,
        category=asset.category,
        mime_type=asset.mime_type,
        file_size_bytes=asset.file_size_bytes,
        width=asset.width,
        height=asset.height,
        sort_order=asset.sort_order,
        processing_status=asset.processing_status,
        translations=asset.translations,
        title=asset.title,
        description=asset.description,
        original_url=original_url,
        thumbnail_url=thumbnail_url,
        created_at=asset.created_at,
    )
