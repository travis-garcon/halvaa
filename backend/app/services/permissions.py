import uuid
from collections.abc import Iterable

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.collaborator import MemorialCollaborator
from app.models.enums import CollaboratorRole, MemorialStatus
from app.models.memorial import Memorial
from app.models.user import User

ROLE_RANK: dict[CollaboratorRole, int] = {
    CollaboratorRole.VIEWER: 1,
    CollaboratorRole.EDITOR: 2,
    CollaboratorRole.OWNER: 3,
}

SEARCHABLE_STATUSES = {MemorialStatus.PUBLISHED, MemorialStatus.FEATURED}

MemorialCapability = str

CAPABILITY_VIEW = "memorial:view"
CAPABILITY_EDIT = "memorial:edit"
CAPABILITY_SUBMIT = "memorial:submit"
CAPABILITY_MODERATE_GUESTBOOK = "memorial:moderate_guestbook"
CAPABILITY_MANAGE_COLLABORATORS = "memorial:manage_collaborators"
CAPABILITY_REVIEW = "memorial:review"
CAPABILITY_FEATURE = "memorial:feature"

ROLE_CAPABILITIES: dict[CollaboratorRole, frozenset[MemorialCapability]] = {
    CollaboratorRole.VIEWER: frozenset({CAPABILITY_VIEW}),
    CollaboratorRole.EDITOR: frozenset({CAPABILITY_VIEW, CAPABILITY_EDIT, CAPABILITY_SUBMIT, CAPABILITY_MODERATE_GUESTBOOK}),
    CollaboratorRole.OWNER: frozenset(
        {
            CAPABILITY_VIEW,
            CAPABILITY_EDIT,
            CAPABILITY_SUBMIT,
            CAPABILITY_MODERATE_GUESTBOOK,
            CAPABILITY_MANAGE_COLLABORATORS,
        }
    ),
}


def get_memorial_or_404(session: Session, memorial_id: uuid.UUID) -> Memorial:
    memorial = session.get(Memorial, memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    return memorial


def get_collaborator_role(
    session: Session,
    memorial_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CollaboratorRole | None:
    collaborator = session.exec(
        select(MemorialCollaborator).where(
            MemorialCollaborator.memorial_id == memorial_id,
            MemorialCollaborator.user_id == user_id,
            MemorialCollaborator.accepted_at.is_not(None),
        )
    ).first()
    return collaborator.role if collaborator else None


def resolve_effective_role(
    session: Session,
    memorial: Memorial,
    user: User,
) -> CollaboratorRole | None:
    if user.is_superuser:
        return CollaboratorRole.OWNER
    if memorial.created_by_id == user.id:
        return CollaboratorRole.OWNER
    return get_collaborator_role(session, memorial.id, user.id)


def require_memorial_access(
    session: Session,
    memorial_id: uuid.UUID,
    user: User,
    minimum_role: CollaboratorRole = CollaboratorRole.VIEWER,
) -> Memorial:
    memorial = get_memorial_or_404(session, memorial_id)
    role = resolve_effective_role(session, memorial, user)
    if role is None or ROLE_RANK[role] < ROLE_RANK[minimum_role]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return memorial


def require_public_memorial(memorial: Memorial) -> Memorial:
    if memorial.status not in SEARCHABLE_STATUSES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    return memorial


def get_memorial_capabilities(
    session: Session,
    memorial: Memorial,
    user: User,
) -> frozenset[MemorialCapability]:
    if user.is_superuser:
        return frozenset(
            {
                CAPABILITY_VIEW,
                CAPABILITY_EDIT,
                CAPABILITY_SUBMIT,
                CAPABILITY_MODERATE_GUESTBOOK,
                CAPABILITY_MANAGE_COLLABORATORS,
                CAPABILITY_REVIEW,
                CAPABILITY_FEATURE,
            }
        )
    role = resolve_effective_role(session, memorial, user)
    if role is None:
        return frozenset()
    return ROLE_CAPABILITIES[role]


def has_memorial_capability(
    session: Session,
    memorial: Memorial,
    user: User,
    capability: MemorialCapability,
) -> bool:
    return capability in get_memorial_capabilities(session, memorial, user)


def require_memorial_capability(
    session: Session,
    memorial: Memorial,
    user: User,
    capability: MemorialCapability,
) -> Memorial:
    if not has_memorial_capability(session, memorial, user, capability):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return memorial


def require_memorial_capabilities(
    session: Session,
    memorial: Memorial,
    user: User,
    capabilities: Iterable[MemorialCapability],
) -> Memorial:
    available = get_memorial_capabilities(session, memorial, user)
    if any(capability not in available for capability in capabilities):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return memorial
