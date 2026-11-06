from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.models.enums import MediaType

ALLOWED_EXTENSIONS: dict[MediaType, set[str]] = {
    MediaType.IMAGE: {".jpg", ".jpeg", ".png", ".webp"},
    MediaType.VIDEO: {".mp4"},
    MediaType.DOCUMENT: {".pdf"},
}

# Resolve extension → type by priority (images before documents).
_MEDIA_TYPE_PRIORITY: tuple[MediaType, ...] = (
    MediaType.IMAGE,
    MediaType.VIDEO,
    MediaType.DOCUMENT,
)

MAGIC_SIGNATURES: dict[MediaType, list[bytes]] = {
    MediaType.IMAGE: [
        b"\xff\xd8\xff",
        b"\x89PNG\r\n\x1a\n",
        b"RIFF",
    ],
    MediaType.VIDEO: [
        b"\x00\x00\x00",
    ],
    MediaType.DOCUMENT: [
        b"%PDF",
    ],
}

MIME_BY_EXTENSION: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
}

READ_CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class ValidatedUpload:
    media_type: MediaType
    extension: str
    mime_type: str
    content: bytes


def _detect_media_type(extension: str) -> MediaType:
    for media_type in _MEDIA_TYPE_PRIORITY:
        if extension in ALLOWED_EXTENSIONS[media_type]:
            return media_type
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file extension")


def _max_bytes_for(media_type: MediaType) -> int:
    settings = get_settings()
    if media_type == MediaType.VIDEO:
        return settings.max_video_bytes
    if media_type == MediaType.DOCUMENT:
        return settings.max_document_bytes
    return settings.max_image_bytes


def _validate_magic_bytes(content: bytes, media_type: MediaType) -> None:
    if media_type == MediaType.IMAGE:
        if content.startswith(b"\xff\xd8\xff"):
            return
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return
        if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            return
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file")
    if media_type == MediaType.VIDEO:
        if len(content) >= 12 and content[4:8] == b"ftyp":
            return
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video file")
    if media_type == MediaType.DOCUMENT:
        if content.startswith(b"%PDF"):
            return
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document file")


async def _read_upload_with_limit(file: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File too large",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def validate_upload(file: UploadFile) -> ValidatedUpload:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if not extension:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file extension")

    media_type = _detect_media_type(extension)
    max_bytes = _max_bytes_for(media_type)
    content = await _read_upload_with_limit(file, max_bytes)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")

    _validate_magic_bytes(content, media_type)
    mime_type = MIME_BY_EXTENSION.get(extension)
    if mime_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported MIME type")

    return ValidatedUpload(
        media_type=media_type,
        extension=extension,
        mime_type=mime_type,
        content=content,
    )
