import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image
from sqlmodel import Session

from app.core.config import get_settings
from app.core.database import engine
from app.models.enums import MediaCategory, MediaProcessingStatus, MediaType
from app.models.media import MediaAsset


def _storage_paths(memorial_id: uuid.UUID, asset_id: uuid.UUID, extension: str) -> tuple[Path, Path]:
    settings = get_settings()
    base = Path(settings.upload_dir) / "memorials" / str(memorial_id) / str(asset_id)
    base.mkdir(parents=True, exist_ok=True)
    original = base / f"original{extension}"
    thumbnail = base / "thumb_400.webp"
    return original, thumbnail


def generate_webp_thumbnail(source_bytes: bytes, max_dimension: int) -> tuple[bytes, int, int]:
    with Image.open(BytesIO(source_bytes)) as image:
        image = image.convert("RGB")
        image.thumbnail((max_dimension, max_dimension))
        output = BytesIO()
        image.save(output, format="WEBP", quality=82, method=6)
        width, height = image.size
        return output.getvalue(), width, height


def process_media_thumbnail(session: Session, asset_id: uuid.UUID) -> None:
    settings = get_settings()
    asset = session.get(MediaAsset, asset_id)
    if asset is None or asset.media_type != MediaType.IMAGE:
        return

    original_path = Path(asset.original_storage_key)
    if not original_path.exists():
        asset.processing_status = MediaProcessingStatus.FAILED
        session.add(asset)
        session.commit()
        return

    try:
        source_bytes = original_path.read_bytes()
        thumb_bytes, width, height = generate_webp_thumbnail(
            source_bytes,
            settings.thumbnail_max_dimension,
        )
        thumb_path = original_path.parent / "thumb_400.webp"
        thumb_path.write_bytes(thumb_bytes)
        asset.thumbnail_storage_key = str(thumb_path)
        asset.width = width
        asset.height = height
        asset.processing_status = MediaProcessingStatus.COMPLETED
    except Exception:
        asset.processing_status = MediaProcessingStatus.FAILED
    session.add(asset)
    session.commit()


def save_upload_and_enqueue(
    session: Session,
    memorial_id: uuid.UUID,
    validated_content: bytes,
    extension: str,
    mime_type: str,
    media_type: MediaType,
    category: MediaCategory,
    file_size: int,
) -> MediaAsset:
    asset = MediaAsset(
        memorial_id=memorial_id,
        media_type=media_type,
        category=category,
        mime_type=mime_type,
        file_size_bytes=file_size,
        processing_status=MediaProcessingStatus.PENDING,
    )
    original_path, _ = _storage_paths(memorial_id, asset.id, extension)
    asset.original_storage_key = str(original_path)
    original_path.write_bytes(validated_content)

    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


def process_media_thumbnail_task(asset_id: uuid.UUID) -> None:
    with Session(engine) as session:
        process_media_thumbnail(session, asset_id)
