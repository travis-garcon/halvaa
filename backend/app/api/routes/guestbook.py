import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.core.config import get_settings
from app.models.base import utc_now
from app.models.collaborator import MemorialCollaborator
from app.core.limiter import limiter
from app.models.enums import CollaboratorRole, GuestbookStatus
from app.models.guestbook import GuestbookEntry
from app.models.memorial import Memorial
from app.models.review_event import ReviewEvent
from app.models.user import User
from app.schemas.guestbook import GuestbookCreate, GuestbookModerate, GuestbookPublic, GuestbookQueueItem
from app.services.permissions import CAPABILITY_MODERATE_GUESTBOOK, require_memorial_access, require_memorial_capability, require_public_memorial

router = APIRouter(prefix="/memorials/{memorial_id}/guestbook", tags=["guestbook"])
queue_router = APIRouter(prefix="/guestbook", tags=["guestbook"])
settings = get_settings()


def _guestbook_to_public(entry: GuestbookEntry, session: Session) -> GuestbookPublic:
    reviewer_name = None
    if entry.moderated_by_id is not None:
        reviewer = session.get(User, entry.moderated_by_id)
        reviewer_name = reviewer.full_name if reviewer is not None else None
    return GuestbookPublic(
        id=entry.id,
        author_name=entry.author_name,
        message=entry.message,
        tribute_type=entry.tribute_type,
        relationship_label=entry.relationship_label,
        status=entry.status,
        created_at=entry.created_at,
        moderated_at=entry.moderated_at,
        moderated_by_id=entry.moderated_by_id,
        moderated_by_name=reviewer_name,
    )


@router.get("", response_model=list[GuestbookPublic])
def list_guestbook_entries(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
) -> list[GuestbookPublic]:
    memorial = session.get(Memorial, memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    require_public_memorial(memorial)

    entries = session.exec(
        select(GuestbookEntry)
        .where(
            GuestbookEntry.memorial_id == memorial_id,
            GuestbookEntry.status == GuestbookStatus.APPROVED,
        )
        .order_by(GuestbookEntry.created_at.desc())
    ).all()
    return [_guestbook_to_public(entry, session) for entry in entries]


@queue_router.get("/pending", response_model=list[GuestbookQueueItem])
def list_pending_guestbook_queue(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    locale: str = "en",
) -> list[GuestbookQueueItem]:
    if current_user.is_superuser:
        rows = session.exec(
            select(GuestbookEntry, Memorial)
            .join(Memorial, Memorial.id == GuestbookEntry.memorial_id)
            .where(GuestbookEntry.status == GuestbookStatus.PENDING)
            .order_by(GuestbookEntry.created_at.desc())
        ).all()
    else:
        collaborated_memorial_ids = session.exec(
            select(MemorialCollaborator.memorial_id).where(
                MemorialCollaborator.user_id == current_user.id,
                MemorialCollaborator.accepted_at.is_not(None),
                MemorialCollaborator.role.in_([CollaboratorRole.OWNER, CollaboratorRole.EDITOR]),
            )
        ).all()
        created_memorial_ids = session.exec(select(Memorial.id).where(Memorial.created_by_id == current_user.id)).all()
        accessible_memorial_ids = {memorial_id for memorial_id in [*collaborated_memorial_ids, *created_memorial_ids] if memorial_id}
        if not accessible_memorial_ids:
            return []
        rows = session.exec(
            select(GuestbookEntry, Memorial)
            .join(Memorial, Memorial.id == GuestbookEntry.memorial_id)
            .where(
                GuestbookEntry.status == GuestbookStatus.PENDING,
                GuestbookEntry.memorial_id.in_(accessible_memorial_ids),
            )
            .order_by(GuestbookEntry.created_at.desc())
        ).all()

    items: list[GuestbookQueueItem] = []
    for entry, memorial in rows:
        memorial_name = None
        if memorial.translations:
            memorial_name = (
                memorial.translations.get(locale, {}).get("name")
                or memorial.translations.get("en", {}).get("name")
                or next((layer.get("name") for layer in memorial.translations.values() if isinstance(layer, dict) and layer.get("name")), None)
            )
        items.append(
            GuestbookQueueItem(
                id=entry.id,
                author_name=entry.author_name,
                message=entry.message,
                tribute_type=entry.tribute_type,
                relationship_label=entry.relationship_label,
                status=entry.status,
                created_at=entry.created_at,
                memorial_id=memorial.id,
                memorial_slug=memorial.slug,
                memorial_name=memorial_name,
            )
        )
    return items


@router.post("", response_model=GuestbookPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_guestbook)
def create_guestbook_entry(
    request: Request,
    memorial_id: uuid.UUID,
    payload: GuestbookCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> GuestbookPublic:
    memorial = session.get(Memorial, memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    require_public_memorial(memorial)

    entry = GuestbookEntry(
        memorial_id=memorial_id,
        author_name=payload.author_name,
        message=payload.message,
        tribute_type=payload.tribute_type,
        relationship_label=payload.relationship_label,
        status=GuestbookStatus.PENDING,
        author_user_id=current_user.id if current_user else None,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return _guestbook_to_public(entry, session)


@router.patch("/{entry_id}", response_model=GuestbookPublic)
def moderate_guestbook_entry(
    memorial_id: uuid.UUID,
    entry_id: uuid.UUID,
    payload: GuestbookModerate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GuestbookPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_MODERATE_GUESTBOOK)

    entry = session.get(GuestbookEntry, entry_id)
    if entry is None or entry.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guestbook entry not found")

    if payload.status not in {GuestbookStatus.APPROVED, GuestbookStatus.REJECTED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid moderation status")

    entry.status = payload.status
    entry.moderated_by_id = current_user.id
    entry.moderated_at = utc_now()
    session.add(entry)
    session.add(
        ReviewEvent(
            memorial_id=memorial.id,
            reviewer_id=current_user.id,
            guestbook_entry_id=entry.id,
            kind="GUESTBOOK_MODERATION",
            decision=payload.status,
            subject_name=entry.author_name,
        )
    )
    session.commit()
    session.refresh(entry)
    return _guestbook_to_public(entry, session)


@router.get("/pending", response_model=list[GuestbookPublic])
def list_pending_guestbook_entries(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[GuestbookPublic]:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_MODERATE_GUESTBOOK)
    entries = session.exec(
        select(GuestbookEntry)
        .where(
            GuestbookEntry.memorial_id == memorial_id,
            GuestbookEntry.status == GuestbookStatus.PENDING,
        )
        .order_by(GuestbookEntry.created_at.desc())
    ).all()
    return [_guestbook_to_public(entry, session) for entry in entries]
