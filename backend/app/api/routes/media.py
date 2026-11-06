import uuid
from typing import Annotated, cast

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.limiter import limiter
from app.models.enums import CollaboratorRole, MediaCategory, MediaType
from app.models.media import MediaAsset
from app.models.timeline import TimelineEvent
from app.models.user import User
from app.schemas.media import MediaPublic, MediaUpdate
from app.services.media_public import media_asset_is_available, media_asset_to_public
from app.services.media_processor import delete_media_storage, process_media_thumbnail_task, save_upload_and_enqueue
from app.services.permissions import require_memorial_access
from app.services.upload_validator import validate_upload

router = APIRouter(prefix="/memorials/{memorial_id}/media", tags=["media"])
settings = get_settings()


def _media_to_public(asset: MediaAsset) -> MediaPublic:
    return media_asset_to_public(asset)


@router.get("", response_model=list[MediaPublic])
def list_media(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[MediaPublic]:
    require_memorial_access(session, memorial_id, current_user, minimum_role=CollaboratorRole.VIEWER)
    assets = session.exec(
        select(MediaAsset)
        .where(MediaAsset.memorial_id == memorial_id)
        .order_by(MediaAsset.sort_order.asc(), MediaAsset.created_at.desc())
    ).all()
    return [_media_to_public(asset) for asset in assets if media_asset_is_available(asset)]


@router.patch("/{media_id}", response_model=MediaPublic)
def update_media(
    memorial_id: uuid.UUID,
    media_id: uuid.UUID,
    payload: MediaUpdate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MediaPublic:
    require_memorial_access(session, memorial_id, current_user, minimum_role=CollaboratorRole.EDITOR)
    asset = session.get(MediaAsset, media_id)
    if asset is None or asset.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)

    session.add(asset)
    session.commit()
    session.refresh(asset)
    return _media_to_public(asset)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    memorial_id: uuid.UUID,
    media_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_memorial_access(session, memorial_id, current_user, minimum_role=CollaboratorRole.EDITOR)
    asset = session.get(MediaAsset, media_id)
    if asset is None or asset.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    linked_events = session.exec(select(TimelineEvent).where(TimelineEvent.media_id == asset.id)).all()
    for event in linked_events:
        event.media_id = None
        session.add(event)
    session.delete(asset)
    session.commit()
    delete_media_storage(asset)


@router.post("", response_model=MediaPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_upload)
async def upload_media(
    request: Request,
    memorial_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    category: MediaCategory = MediaCategory.GALLERY,
) -> MediaPublic:
    require_memorial_access(session, memorial_id, current_user, minimum_role=CollaboratorRole.EDITOR)
    request.state.user_id = str(current_user.id)

    validated = await validate_upload(file)
    asset = save_upload_and_enqueue(
        session=session,
        memorial_id=memorial_id,
        validated_content=validated.content,
        extension=validated.extension,
        mime_type=validated.mime_type,
        media_type=validated.media_type,
        category=category,
        file_size=len(validated.content),
    )

    if validated.media_type == MediaType.IMAGE:
        background_tasks.add_task(process_media_thumbnail_task, asset.id)

    session.refresh(asset)
    return _media_to_public(asset)
