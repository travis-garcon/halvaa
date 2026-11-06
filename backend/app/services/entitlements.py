from dataclasses import dataclass
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.enums import PurchaseStatus, StoreItemKind
from app.models.memorial import Memorial
from app.models.store import Purchase, StoreItem
from app.models.user import User

FREE_MEMORIAL_LIMIT = 1


@dataclass(frozen=True)
class AccountEntitlements:
    memorial_limit: int
    custom_id_limit: int
    memorials_used: int
    custom_ids_used: int

    @property
    def memorials_remaining(self) -> int:
        return max(self.memorial_limit - self.memorials_used, 0)

    @property
    def custom_ids_remaining(self) -> int:
        return max(self.custom_id_limit - self.custom_ids_used, 0)


def _metadata_int(metadata: dict[str, Any], key: str) -> int:
    value = metadata.get(key)
    return value if isinstance(value, int) and value > 0 else 0


def _paid_entitlement_purchases(session: Session, user: User) -> list[tuple[Purchase, StoreItem]]:
    return list(
        session.exec(
            select(Purchase, StoreItem)
            .join(StoreItem, StoreItem.id == Purchase.store_item_id)
            .where(
                Purchase.user_id == user.id,
                Purchase.status.in_([PurchaseStatus.PAID, PurchaseStatus.ASSIGNED]),
            )
        ).all()
    )


def get_account_entitlements(session: Session, user: User) -> AccountEntitlements:
    if user.is_superuser:
        memorials_used = session.exec(select(func.count()).select_from(Memorial).where(Memorial.created_by_id == user.id)).one()
        return AccountEntitlements(
            memorial_limit=10_000,
            custom_id_limit=10_000,
            memorials_used=int(memorials_used),
            custom_ids_used=0,
        )

    memorial_limit = FREE_MEMORIAL_LIMIT
    custom_id_limit = 0
    custom_ids_used = 0

    for purchase, item in _paid_entitlement_purchases(session, user):
        metadata = item.item_metadata or {}
        if item.kind == StoreItemKind.EXTRA_MEMORIAL_SLOT:
            memorial_limit += _metadata_int(metadata, "slots") or 1
        elif item.kind == StoreItemKind.CUSTOM_MEMORIAL_ID:
            custom_id_limit += _metadata_int(metadata, "custom_ids") or 1
        elif item.kind == StoreItemKind.MEMORIAL_PACKAGE:
            memorial_limit += _metadata_int(metadata, "memorials")
            custom_id_limit += _metadata_int(metadata, "custom_ids")

        assigned_custom_ids = purchase.assignment_payload.get("custom_ids_used") if purchase.assignment_payload else None
        if isinstance(assigned_custom_ids, int) and assigned_custom_ids > 0:
            custom_ids_used += assigned_custom_ids

    memorials_used = session.exec(select(func.count()).select_from(Memorial).where(Memorial.created_by_id == user.id)).one()
    return AccountEntitlements(
        memorial_limit=memorial_limit,
        custom_id_limit=custom_id_limit,
        memorials_used=int(memorials_used),
        custom_ids_used=custom_ids_used,
    )


def has_memorial_slot(session: Session, user: User) -> bool:
    return get_account_entitlements(session, user).memorials_remaining > 0


def has_custom_id_slot(session: Session, user: User) -> bool:
    return get_account_entitlements(session, user).custom_ids_remaining > 0


def consume_custom_id_slot(session: Session, user: User) -> None:
    if user.is_superuser:
        return

    for purchase, item in _paid_entitlement_purchases(session, user):
        metadata = item.item_metadata or {}
        granted = 0
        if item.kind == StoreItemKind.CUSTOM_MEMORIAL_ID:
            granted = _metadata_int(metadata, "custom_ids") or 1
        elif item.kind == StoreItemKind.MEMORIAL_PACKAGE:
            granted = _metadata_int(metadata, "custom_ids")
        if granted <= 0:
            continue

        payload = dict(purchase.assignment_payload or {})
        used = payload.get("custom_ids_used")
        used_count = used if isinstance(used, int) and used > 0 else 0
        if used_count < granted:
            payload["custom_ids_used"] = used_count + 1
            purchase.assignment_payload = payload
            session.add(purchase)
            return

    raise ValueError("No custom memorial ID slots remain")
