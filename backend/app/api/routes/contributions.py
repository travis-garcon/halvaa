import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.models.contribution import MemorialContribution
from app.models.memorial import Memorial
from app.models.user import User
from app.schemas.contribution import ContributionCreate, ContributionPublic, ContributionReview
from app.services.permissions import CAPABILITY_EDIT, has_memorial_capability
from app.services.text_policy import assert_acceptable_text

router = APIRouter(prefix="/memorials/{memorial_id}/contributions", tags=["contributions"])
queue_router = APIRouter(prefix="/contributions", tags=["contributions"])


def _to_public(session: Session, contribution: MemorialContribution) -> ContributionPublic:
    contributor = session.get(User, contribution.contributor_id)
    return ContributionPublic(
        id=contribution.id,
        memorial_id=contribution.memorial_id,
        contributor_id=contribution.contributor_id,
        contributor_name=contributor.full_name if contributor else None,
        reviewed_by_id=contribution.reviewed_by_id,
        contribution_type=contribution.contribution_type,
        status=contribution.status,
        payload=contribution.payload,
        reviewer_note=contribution.reviewer_note,
        created_at=contribution.created_at,
        updated_at=contribution.updated_at,
    )


@router.post("", response_model=ContributionPublic, status_code=status.HTTP_201_CREATED)
def create_contribution(
    memorial_id: uuid.UUID,
    payload: ContributionCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ContributionPublic:
    memorial = session.get(Memorial, memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    assert_acceptable_text([payload.name, payload.biography, payload.epitaph, payload.source_note])
    contribution = MemorialContribution(
        memorial_id=memorial_id,
        contributor_id=current_user.id,
        contribution_type=payload.contribution_type,
        payload=payload.model_dump(exclude_none=True),
    )
    session.add(contribution)
    session.commit()
    session.refresh(contribution)
    return _to_public(session, contribution)


@router.get("", response_model=list[ContributionPublic])
def list_memorial_contributions(
    memorial_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ContributionPublic]:
    memorial = session.get(Memorial, memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    if not has_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT):
        mine = session.exec(
            select(MemorialContribution)
            .where(MemorialContribution.memorial_id == memorial_id, MemorialContribution.contributor_id == current_user.id)
            .order_by(MemorialContribution.created_at.desc())
        ).all()
        return [_to_public(session, item) for item in mine]
    rows = session.exec(
        select(MemorialContribution)
        .where(MemorialContribution.memorial_id == memorial_id)
        .order_by(MemorialContribution.created_at.desc())
    ).all()
    return [_to_public(session, item) for item in rows]


@router.patch("/{contribution_id}", response_model=ContributionPublic)
def review_contribution(
    memorial_id: uuid.UUID,
    contribution_id: uuid.UUID,
    payload: ContributionReview,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ContributionPublic:
    memorial = session.get(Memorial, memorial_id)
    contribution = session.get(MemorialContribution, contribution_id)
    if memorial is None or contribution is None or contribution.memorial_id != memorial_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")
    if not has_memorial_capability(session, memorial, current_user, CAPABILITY_EDIT):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if contribution.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contribution already reviewed")

    contribution.reviewed_by_id = current_user.id
    contribution.reviewer_note = payload.reviewer_note
    contribution.status = "APPROVED" if payload.decision == "APPROVE" else "REJECTED"
    if payload.decision == "APPROVE" and contribution.contribution_type == "PROFILE_TEXT":
        locale = contribution.payload.get("locale", "en")
        existing = memorial.translations or {}
        layer = dict(existing.get(locale, {}))
        for key in ("name", "biography", "epitaph"):
            if contribution.payload.get(key):
                layer[key] = contribution.payload[key]
        existing[locale] = layer
        memorial.translations = existing
        session.add(memorial)

    session.add(contribution)
    session.commit()
    session.refresh(contribution)
    return _to_public(session, contribution)


@queue_router.get("/mine", response_model=list[ContributionPublic])
def list_my_contributions(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ContributionPublic]:
    rows = session.exec(
        select(MemorialContribution)
        .where(MemorialContribution.contributor_id == current_user.id)
        .order_by(MemorialContribution.created_at.desc())
    ).all()
    return [_to_public(session, item) for item in rows]
