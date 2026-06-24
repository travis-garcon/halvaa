import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.models.collaborator import MemorialCollaborator
from app.models.memorial import Memorial
from app.models.user import User
from app.schemas.collaborator import MemorialCollaboratorList, MemorialCollaboratorPublic

router = APIRouter(prefix="/collaborators", tags=["collaborators"])


@router.get("/invitations", response_model=MemorialCollaboratorList)
def list_my_invitations(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialCollaboratorList:
    rows = session.exec(
        select(MemorialCollaborator, Memorial)
        .join(Memorial, Memorial.id == MemorialCollaborator.memorial_id)
        .where(
            MemorialCollaborator.user_id == current_user.id,
            MemorialCollaborator.accepted_at.is_(None),
        )
        .order_by(MemorialCollaborator.invited_at.desc())
    ).all()

    items: list[MemorialCollaboratorPublic] = []
    for collaborator, memorial in rows:
        translations = memorial.translations or {}
        layer = translations.get(current_user.locale) or translations.get("en") or next(iter(translations.values()), {})
        items.append(
            MemorialCollaboratorPublic(
                id=collaborator.id,
                user_id=current_user.id,
                memorial_id=memorial.id,
                memorial_slug=memorial.slug,
                memorial_name=layer.get("name") or memorial.slug,
                full_name=current_user.full_name,
                email=current_user.email,
                role=collaborator.role,
                invited_at=collaborator.invited_at,
                accepted_at=collaborator.accepted_at,
            )
        )

    return MemorialCollaboratorList(items=items)


@router.post("/{collaborator_id}/accept", response_model=MemorialCollaboratorPublic)
def accept_invitation(
    collaborator_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MemorialCollaboratorPublic:
    collaborator = session.get(MemorialCollaborator, collaborator_id)
    if collaborator is None or collaborator.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    memorial = session.get(Memorial, collaborator.memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")

    if collaborator.accepted_at is None:
        collaborator.accepted_at = datetime.now(timezone.utc)
        session.add(collaborator)
        session.commit()
        session.refresh(collaborator)

    translations = memorial.translations or {}
    layer = translations.get(current_user.locale) or translations.get("en") or next(iter(translations.values()), {})
    return MemorialCollaboratorPublic(
        id=collaborator.id,
        user_id=current_user.id,
        memorial_id=memorial.id,
        memorial_slug=memorial.slug,
        memorial_name=layer.get("name") or memorial.slug,
        full_name=current_user.full_name,
        email=current_user.email,
        role=collaborator.role,
        invited_at=collaborator.invited_at,
        accepted_at=collaborator.accepted_at,
    )


@router.delete("/{collaborator_id}", status_code=status.HTTP_204_NO_CONTENT)
def decline_invitation(
    collaborator_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    collaborator = session.get(MemorialCollaborator, collaborator_id)
    if collaborator is None or collaborator.user_id != current_user.id or collaborator.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    session.delete(collaborator)
    session.commit()
