"""Normalize media storage keys that were accidentally saved as localhost URLs.

Run inside the backend container:
    python -m scripts.cleanup_media_storage_keys
"""

from __future__ import annotations

from urllib.parse import urlparse

from sqlmodel import Session, select

from app.core.database import engine
from app.models.media import MediaAsset


def normalize_storage_key(value: str | None) -> str | None:
    if not value:
        return value
    parsed = urlparse(value)
    path = parsed.path if parsed.scheme and parsed.netloc else value
    marker = "/uploads/"
    if marker in path:
        return path.split(marker, 1)[1].lstrip("/")
    if path.startswith("uploads/"):
        return path.removeprefix("uploads/").lstrip("/")
    return value


def cleanup() -> None:
    updated = 0
    with Session(engine) as session:
        assets = session.exec(select(MediaAsset)).all()
        for asset in assets:
            original = normalize_storage_key(asset.original_storage_key)
            thumbnail = normalize_storage_key(asset.thumbnail_storage_key)
            if original != asset.original_storage_key or thumbnail != asset.thumbnail_storage_key:
                asset.original_storage_key = original or asset.original_storage_key
                asset.thumbnail_storage_key = thumbnail
                session.add(asset)
                updated += 1
        session.commit()
    print(f"Normalized storage keys for {updated} media assets.")


if __name__ == "__main__":
    cleanup()
