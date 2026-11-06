from pathlib import Path
from urllib.parse import urlencode, urlparse

from app.core.config import get_settings
from app.models.media import MediaAsset
from app.schemas.media import MediaPublic

MEDIA_URL_VERSION = 2


def _local_storage_path(storage_key: str | None) -> Path | None:
    if not storage_key or storage_key.startswith(("http://", "https://", "/images/")):
        return None

    path = Path(storage_key)
    if path.is_absolute():
        return path

    upload_root = Path(get_settings().upload_dir)
    normalized = path.as_posix()
    if "uploads/" in normalized:
        normalized = normalized.split("uploads/", 1)[1]
    return upload_root / normalized


def storage_key_is_available(storage_key: str | None) -> bool:
    if not storage_key:
        return False
    if storage_key.startswith(("http://", "https://", "/images/")):
        return True
    local_path = _local_storage_path(storage_key)
    return bool(local_path and local_path.is_file())


def media_asset_is_available(asset: MediaAsset) -> bool:
    return storage_key_is_available(asset.original_storage_key) or storage_key_is_available(asset.thumbnail_storage_key)


def _absolute_upload_url(path: str) -> str:
    if path.startswith(("http://", "https://")):
        parsed = urlparse(path)
        if parsed.hostname in {"localhost", "127.0.0.1"}:
            return f"{parsed.path}{f'?{parsed.query}' if parsed.query else ''}"
        return path
    settings = get_settings()
    base_url = settings.public_api_base_url.rstrip("/")
    if urlparse(base_url).hostname in {"localhost", "127.0.0.1"}:
        normalized = path if path.startswith("/") else f"/{path}"
        return normalized
    normalized = path if path.startswith("/") else f"/{path}"
    return f"{base_url}{normalized}"


def media_asset_to_public(asset: MediaAsset) -> MediaPublic:
    original_key = asset.original_storage_key
    if original_key.startswith("/images/"):
        original_url = original_key
        thumbnail_url = asset.thumbnail_storage_key if asset.thumbnail_storage_key and asset.thumbnail_storage_key.startswith("/images/") else asset.thumbnail_storage_key if asset.thumbnail_storage_key and asset.thumbnail_storage_key.startswith(("http://", "https://")) else None
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
    available_original_key = original_key
    if not storage_key_is_available(original_key) and storage_key_is_available(asset.thumbnail_storage_key):
        available_original_key = asset.thumbnail_storage_key or original_key
    original_stem = Path(available_original_key).as_posix()
    if "uploads/" in original_stem:
        original_stem = original_stem.split("uploads/", 1)[1]
    version_query = urlencode({"v": int(asset.updated_at.timestamp()), "media": MEDIA_URL_VERSION})
    original_url = _absolute_upload_url(f"/uploads/{original_stem}?{version_query}")
    thumbnail_url = None
    if storage_key_is_available(asset.thumbnail_storage_key):
        thumb_stem = Path(asset.thumbnail_storage_key).as_posix()
        if "uploads/" in thumb_stem:
            thumb_stem = thumb_stem.split("uploads/", 1)[1]
        thumbnail_url = _absolute_upload_url(f"/uploads/{thumb_stem}?{version_query}")
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
