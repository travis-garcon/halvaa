import uuid
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.models.collaborator import MemorialCollaborator
from app.models.base import utc_now
from app.models.enums import CollaboratorRole, GuestbookStatus, MemorialStatus
from app.models.guestbook import GuestbookEntry
from app.models.media import MediaAsset
from app.models.memorial import Memorial
from app.models.review_event import ReviewEvent
from app.models.timeline import TimelineEvent
from app.models.user import User
from app.schemas.collaborator import MemorialCollaboratorInvite, MemorialCollaboratorList, MemorialCollaboratorPublic, MemorialCollaboratorUpdate
from app.schemas.memorial import (
    MemorialApprovalQueueItem,
    MemorialCreate,
    MemorialProfilePublic,
    MemorialPublic,
    MemorialReviewActivityItem,
    MemorialReviewUpdate,
    MemorialStatusUpdate,
    MemorialUpdate,
)
from app.schemas.timeline import TimelineEventCreate, TimelineEventPublic, TimelineEventUpdate
from app.services.media_public import media_asset_to_public
from app.services.memorials import apply_coordinates, memorial_to_profile_public, memorial_to_public
from app.services.memorial_workflow import apply_status_transition, review_pending_memorial
from app.services.permissions import (
    CAPABILITY_EDIT,
    CAPABILITY_FEATURE,
    CAPABILITY_MANAGE_COLLABORATORS,
    CAPABILITY_REVIEW,
    CAPABILITY_SUBMIT,
    has_memorial_capability,
    require_memorial_access,
    require_memorial_capability,
    resolve_effective_role,
)

router = APIRouter(prefix="/memorials", tags=["memorials"])


def _collaborator_to_public(collaborator: MemorialCollaborator, user: User) -> MemorialCollaboratorPublic:
    return MemorialCollaboratorPublic(
        id=collaborator.id,
        user_id=user.id,
        memorial_id=collaborator.memorial_id,
        full_name=user.full_name,
        email=user.email,
        role=collaborator.role,
        invited_at=collaborator.invited_at,
        accepted_at=collaborator.accepted_at,
    )


def _read_memorial(
    memorial: Memorial,
    session: Session,
    current_user: User | None,
    *,
    profile: bool = False,
) -> MemorialPublic | MemorialProfilePublic:
    if memorial.status in {MemorialStatus.PUBLISHED, MemorialStatus.FEATURED}:
        return memorial_to_profile_public(session, memorial) if profile else memorial_to_public(session, memorial)

    if current_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")

    role = resolve_effective_role(session, memorial, current_user)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")

    return memorial_to_profile_public(session, memorial) if profile else memorial_to_public(session, memorial)


def _get_memorial_name(memorial: Memorial, locale: str) -> str | None:
    if not memorial.translations:
        return None
    return (
        memorial.translations.get(locale, {}).get("name")
        or memorial.translations.get("en", {}).get("name")
        or next((layer.get("name") for layer in memorial.translations.values() if isinstance(layer, dict) and layer.get("name")), None)
    )


def _timeline_to_public(session: Session, event: TimelineEvent) -> TimelineEventPublic:
    thumbnail_url = None
    if event.media_id:
        asset = session.get(MediaAsset, event.media_id)
        if asset is not None:
            thumbnail_url = media_asset_to_public(asset).thumbnail_url
    return TimelineEventPublic(
        id=event.id,
        event_type=event.event_type,
        sort_order=event.sort_order,
        event_date=event.event_date,
        translations=event.translations,
        media_id=event.media_id,
        thumbnail_url=thumbnail_url,
    )


def _validate_timeline_media(
    session: Session,
    memorial_id: uuid.UUID,
    media_id: uuid.UUID | None,
) -> uuid.UUID | None:
    if media_id is None:
        return None
    asset = session.get(MediaAsset, media_id)
    if asset is None or asset.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timeline media must belong to this memorial")
    return media_id


def _record_review_event(
    session: Session,
    *,
    memorial_id: uuid.UUID,
    reviewer_id: uuid.UUID | None,
    kind: str,
    decision: str,
    subject_name: str | None,
    guestbook_entry_id: uuid.UUID | None = None,
) -> None:
    session.add(
        ReviewEvent(
            memorial_id=memorial_id,
            reviewer_id=reviewer_id,
            guestbook_entry_id=guestbook_entry_id,
            kind=kind,
            decision=decision,
            subject_name=subject_name,
        )
    )


@router.post("", response_model=MemorialPublic, status_code=status.HTTP_201_CREATED)
def create_memorial(
    payload: MemorialCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialPublic:
    existing = session.exec(select(Memorial).where(Memorial.slug == payload.slug)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

    memorial = Memorial(
        slug=payload.slug,
        birth_date=payload.birth_date,
        death_date=payload.death_date,
        burial_address=payload.burial_address,
        burial_site_name=payload.burial_site_name,
        burial_plot_name=payload.burial_plot_name,
        qr_code_url=payload.qr_code_url,
        translations=payload.translations,
        theme_overrides=payload.theme_overrides,
        family_tree=payload.family_tree,
        created_by_id=current_user.id,
        status=MemorialStatus.DRAFT,
    )
    try:
        apply_coordinates(memorial, payload.latitude, payload.longitude)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    session.add(memorial)
    session.flush()

    session.add(
        MemorialCollaborator(
            memorial_id=memorial.id,
            user_id=current_user.id,
            role=CollaboratorRole.OWNER,
        )
    )
    session.commit()
    session.refresh(memorial)
    return memorial_to_public(session, memorial)


@router.get("/mine", response_model=list[MemorialPublic])
def my_memorials(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[MemorialPublic]:
    created = session.exec(select(Memorial).where(Memorial.created_by_id == current_user.id)).all()
    collaborated = session.exec(
        select(Memorial)
        .join(MemorialCollaborator)
        .where(
            MemorialCollaborator.user_id == current_user.id,
            MemorialCollaborator.accepted_at.is_not(None),
        )
    ).all()
    memorials_by_id = {memorial.id: memorial for memorial in [*created, *collaborated]}
    memorials = sorted(memorials_by_id.values(), key=lambda memorial: memorial.updated_at, reverse=True)
    return [memorial_to_public(session, memorial) for memorial in memorials]


@router.get("/pending-approvals", response_model=list[MemorialApprovalQueueItem])
def list_pending_memorial_approvals(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    locale: str = "en",
) -> list[MemorialApprovalQueueItem]:
    if not current_user.is_superuser:
        return []

    rows = session.exec(
        select(Memorial, User)
        .join(User, User.id == Memorial.created_by_id)
        .where(Memorial.status == MemorialStatus.PENDING_APPROVAL)
        .order_by(Memorial.updated_at.desc())
    ).all()

    items: list[MemorialApprovalQueueItem] = []
    for memorial, user in rows:
        reviewer_name = None
        if memorial.last_reviewed_by_id is not None:
            reviewer = session.get(User, memorial.last_reviewed_by_id)
            reviewer_name = reviewer.full_name if reviewer is not None else None
        items.append(
            MemorialApprovalQueueItem(
                id=memorial.id,
                slug=memorial.slug,
                status=memorial.status,
                created_at=memorial.created_at,
                updated_at=memorial.updated_at,
                submitted_at=memorial.updated_at,
                published_at=memorial.published_at,
                memorial_name=_get_memorial_name(memorial, locale),
                submitted_by_name=user.full_name,
                last_reviewed_at=memorial.last_reviewed_at,
                last_review_decision=memorial.last_review_decision,
                last_reviewed_by_name=reviewer_name,
            )
        )
    return items


@router.get("/slug/{slug}", response_model=MemorialProfilePublic)
def get_memorial_by_slug(
    slug: str,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> MemorialProfilePublic:
    memorial = session.exec(select(Memorial).where(Memorial.slug == slug)).first()
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    return cast(MemorialProfilePublic, _read_memorial(memorial, session, current_user, profile=True))


@router.get("/{memorial_id}", response_model=MemorialPublic)
def get_memorial(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
) -> MemorialPublic:
    memorial = session.get(Memorial, memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    return _read_memorial(memorial, session, current_user)


@router.patch("/{memorial_id}", response_model=MemorialPublic)
def update_memorial(
    memorial_id: uuid.UUID,
    payload: MemorialUpdate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)

    update_data = payload.model_dump(exclude_unset=True)
    status_value = update_data.pop("status", None)
    latitude = update_data.pop("latitude", None)
    longitude = update_data.pop("longitude", None)

    for field, value in update_data.items():
        setattr(memorial, field, value)

    if latitude is not None or longitude is not None:
        try:
            apply_coordinates(memorial, latitude, longitude)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if status_value is not None:
        if status_value == MemorialStatus.PENDING_APPROVAL:
            require_memorial_capability(session, memorial, current_user, CAPABILITY_SUBMIT)
        elif status_value == MemorialStatus.FEATURED:
            require_memorial_capability(session, memorial, current_user, CAPABILITY_FEATURE)
        elif status_value == MemorialStatus.PUBLISHED:
            if not (
                has_memorial_capability(session, memorial, current_user, CAPABILITY_REVIEW)
                or has_memorial_capability(session, memorial, current_user, CAPABILITY_FEATURE)
            ):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        else:
            require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)
        apply_status_transition(memorial, status_value)

    session.add(memorial)
    session.commit()
    session.refresh(memorial)
    return memorial_to_public(session, memorial)


@router.post("/{memorial_id}/status", response_model=MemorialPublic)
def update_memorial_status(
    memorial_id: uuid.UUID,
    payload: MemorialStatusUpdate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )

    if payload.status == MemorialStatus.PENDING_APPROVAL:
        require_memorial_capability(session, memorial, current_user, CAPABILITY_SUBMIT)
    elif payload.status == MemorialStatus.FEATURED:
        require_memorial_capability(session, memorial, current_user, CAPABILITY_FEATURE)
    elif payload.status == MemorialStatus.PUBLISHED:
        if not (
            has_memorial_capability(session, memorial, current_user, CAPABILITY_REVIEW)
            or has_memorial_capability(session, memorial, current_user, CAPABILITY_FEATURE)
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    apply_status_transition(memorial, payload.status)
    session.add(memorial)
    session.commit()
    session.refresh(memorial)
    return memorial_to_public(session, memorial)


@router.post("/{memorial_id}/review", response_model=MemorialPublic)
def review_memorial(
    memorial_id: uuid.UUID,
    payload: MemorialReviewUpdate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.VIEWER,
    )
    if payload.decision == "FEATURE":
        require_memorial_capability(session, memorial, current_user, CAPABILITY_FEATURE)
    else:
        require_memorial_capability(session, memorial, current_user, CAPABILITY_REVIEW)

    review_pending_memorial(memorial, payload.decision)
    memorial.last_reviewed_at = utc_now()
    memorial.last_review_decision = payload.decision
    memorial.last_reviewed_by_id = current_user.id
    _record_review_event(
        session,
        memorial_id=memorial.id,
        reviewer_id=current_user.id,
        kind="MEMORIAL_REVIEW",
        decision=payload.decision,
        subject_name=_get_memorial_name(memorial, "en") or memorial.slug,
    )
    session.add(memorial)
    session.commit()
    session.refresh(memorial)
    return memorial_to_public(session, memorial)


@router.get("/{memorial_id}/review-history", response_model=list[MemorialReviewActivityItem])
def get_memorial_review_history(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 10,
) -> list[MemorialReviewActivityItem]:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)

    safe_limit = max(1, min(limit, 50))
    rows = session.exec(
        select(ReviewEvent, User)
        .join(User, User.id == ReviewEvent.reviewer_id, isouter=True)
        .where(ReviewEvent.memorial_id == memorial_id)
        .order_by(ReviewEvent.created_at.desc())
        .limit(safe_limit)
    ).all()
    return [
        MemorialReviewActivityItem(
            kind=event.kind,
            created_at=event.created_at,
            reviewer_name=user.full_name if user is not None else None,
            decision=event.decision,
            subject_name=event.subject_name,
        )
        for event, user in rows
    ]


@router.post("/{memorial_id}/timeline", response_model=TimelineEventPublic, status_code=status.HTTP_201_CREATED)
def create_timeline_event(
    memorial_id: uuid.UUID,
    payload: TimelineEventCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TimelineEventPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)
    event = TimelineEvent(
        memorial_id=memorial_id,
        event_type=payload.event_type,
        sort_order=payload.sort_order,
        event_date=payload.event_date,
        translations=payload.translations,
        media_id=_validate_timeline_media(session, memorial_id, payload.media_id),
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return _timeline_to_public(session, event)


@router.patch("/{memorial_id}/timeline/{event_id}", response_model=TimelineEventPublic)
def update_timeline_event(
    memorial_id: uuid.UUID,
    event_id: uuid.UUID,
    payload: TimelineEventUpdate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TimelineEventPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)
    event = session.get(TimelineEvent, event_id)
    if event is None or event.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "media_id" in update_data:
        update_data["media_id"] = _validate_timeline_media(session, memorial_id, payload.media_id)

    for field, value in update_data.items():
        setattr(event, field, value)

    session.add(event)
    session.commit()
    session.refresh(event)
    return _timeline_to_public(session, event)


@router.delete("/{memorial_id}/timeline/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timeline_event(
    memorial_id: uuid.UUID,
    event_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)
    event = session.get(TimelineEvent, event_id)
    if event is None or event.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    session.delete(event)
    session.commit()


@router.get("/{memorial_id}/collaborators", response_model=MemorialCollaboratorList)
def list_memorial_collaborators(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialCollaboratorList:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.EDITOR,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT)
    collaborators = session.exec(
        select(MemorialCollaborator, User)
        .join(User, User.id == MemorialCollaborator.user_id)
        .where(MemorialCollaborator.memorial_id == memorial.id)
        .order_by(MemorialCollaborator.invited_at.asc())
    ).all()
    return MemorialCollaboratorList(items=[_collaborator_to_public(collaborator, user) for collaborator, user in collaborators])


@router.post("/{memorial_id}/collaborators", response_model=MemorialCollaboratorPublic, status_code=status.HTTP_201_CREATED)
def add_memorial_collaborator(
    memorial_id: uuid.UUID,
    payload: MemorialCollaboratorInvite,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialCollaboratorPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.OWNER,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_MANAGE_COLLABORATORS)

    if payload.role == CollaboratorRole.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use existing ownership workflow for owners")

    user = session.exec(select(User).where(User.email == payload.email)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == memorial.created_by_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner is already attached to this memorial")

    existing = session.exec(
        select(MemorialCollaborator).where(
            MemorialCollaborator.memorial_id == memorial.id,
            MemorialCollaborator.user_id == user.id,
        )
    ).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Collaborator already exists")

    collaborator = MemorialCollaborator(
        memorial_id=memorial.id,
        user_id=user.id,
        role=payload.role,
        accepted_at=None,
    )
    session.add(collaborator)
    session.commit()
    session.refresh(collaborator)
    return _collaborator_to_public(collaborator, user)


@router.delete("/{memorial_id}/collaborators/{collaborator_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_memorial_collaborator(
    memorial_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.OWNER,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_MANAGE_COLLABORATORS)
    collaborator = session.get(MemorialCollaborator, collaborator_id)
    if collaborator is None or collaborator.memorial_id != memorial.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")
    if collaborator.role == CollaboratorRole.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the owner collaborator")
    session.delete(collaborator)
    session.commit()


@router.patch("/{memorial_id}/collaborators/{collaborator_id}", response_model=MemorialCollaboratorPublic)
def update_memorial_collaborator(
    memorial_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    payload: MemorialCollaboratorUpdate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialCollaboratorPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.OWNER,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_MANAGE_COLLABORATORS)
    collaborator = session.get(MemorialCollaborator, collaborator_id)
    if collaborator is None or collaborator.memorial_id != memorial.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")
    if collaborator.role == CollaboratorRole.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change the owner collaborator")
    if payload.role == CollaboratorRole.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner role cannot be assigned here")

    collaborator.role = payload.role
    session.add(collaborator)
    session.commit()
    session.refresh(collaborator)
    user = session.get(User, collaborator.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _collaborator_to_public(collaborator, user)


@router.post("/{memorial_id}/collaborators/{collaborator_id}/resend", response_model=MemorialCollaboratorPublic)
def resend_memorial_collaborator_invitation(
    memorial_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialCollaboratorPublic:
    memorial = require_memorial_access(
        session,
        memorial_id,
        current_user,
        minimum_role=CollaboratorRole.OWNER,
    )
    require_memorial_capability(session, memorial, current_user, CAPABILITY_MANAGE_COLLABORATORS)
    collaborator = session.get(MemorialCollaborator, collaborator_id)
    if collaborator is None or collaborator.memorial_id != memorial.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")
    if collaborator.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending invitations can be resent")

    collaborator.invited_at = utc_now()
    session.add(collaborator)
    session.commit()
    session.refresh(collaborator)
    user = session.get(User, collaborator.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _collaborator_to_public(collaborator, user)
