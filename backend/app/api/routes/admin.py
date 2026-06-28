from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

from app.api.deps import get_current_user, get_db
from app.models.enums import MemorialStatus, PurchaseStatus, UserRole
from app.models.guestbook import GuestbookEntry
from app.models.memorial import Memorial
from app.models.store import LandingMemorialPlacement, Purchase
from app.models.user import User
from app.schemas.admin import AdminKpis, LandingPlacementCreate, LandingPlacementPublic

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User) -> None:
    if not (user.is_superuser or user.role == UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


def _memorial_name(memorial: Memorial, locale: str) -> str | None:
    return (
        memorial.translations.get(locale, {}).get("name")
        or memorial.translations.get("en", {}).get("name")
        or next((layer.get("name") for layer in memorial.translations.values() if isinstance(layer, dict) and layer.get("name")), None)
    )


def _placement_to_public(session: Session, placement: LandingMemorialPlacement, locale: str) -> LandingPlacementPublic:
    memorial = session.get(Memorial, placement.memorial_id)
    return LandingPlacementPublic(
        id=placement.id,
        memorial_id=placement.memorial_id,
        category=placement.category,
        sort_order=placement.sort_order,
        label=placement.label,
        is_active=placement.is_active,
        created_at=placement.created_at,
        memorial_slug=memorial.slug if memorial else "",
        memorial_name=_memorial_name(memorial, locale) if memorial else None,
    )


@router.get("/kpis", response_model=AdminKpis)
def get_admin_kpis(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AdminKpis:
    require_admin(current_user)
    users = session.exec(select(func.count()).select_from(User)).one()
    memorials = session.exec(select(func.count()).select_from(Memorial)).one()
    published = session.exec(select(func.count()).select_from(Memorial).where(Memorial.status.in_([MemorialStatus.PUBLISHED, MemorialStatus.FEATURED]))).one()
    guestbook = session.exec(select(func.count()).select_from(GuestbookEntry)).one()
    purchases = session.exec(select(Purchase).where(Purchase.status.in_([PurchaseStatus.PAID, PurchaseStatus.ASSIGNED]))).all()
    return AdminKpis(
        users=int(users),
        memorials=int(memorials),
        published_memorials=int(published),
        guestbook_entries=int(guestbook),
        income_usd_cents=sum(p.amount for p in purchases if p.currency == "USD"),
        income_irr=sum(p.amount for p in purchases if p.currency == "IRR"),
    )


@router.get("/landing-placements", response_model=list[LandingPlacementPublic])
def list_landing_placements(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    locale: str = "en",
) -> list[LandingPlacementPublic]:
    require_admin(current_user)
    rows = session.exec(select(LandingMemorialPlacement).order_by(LandingMemorialPlacement.category.asc(), LandingMemorialPlacement.sort_order.asc())).all()
    return [_placement_to_public(session, row, locale) for row in rows]


@router.post("/landing-placements", response_model=LandingPlacementPublic, status_code=status.HTTP_201_CREATED)
def create_landing_placement(
    payload: LandingPlacementCreate,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    locale: str = "en",
) -> LandingPlacementPublic:
    require_admin(current_user)
    memorial = session.get(Memorial, payload.memorial_id)
    if memorial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memorial not found")
    placement = LandingMemorialPlacement(**payload.model_dump())
    session.add(placement)
    session.commit()
    session.refresh(placement)
    return _placement_to_public(session, placement, locale)


@router.delete("/landing-placements/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_landing_placement(
    placement_id: str,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_admin(current_user)
    placement = session.get(LandingMemorialPlacement, placement_id)
    if placement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Placement not found")
    session.delete(placement)
    session.commit()
