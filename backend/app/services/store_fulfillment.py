from sqlmodel import Session

from app.models.base import utc_now
from app.models.enums import PurchaseStatus, StoreItemKind
from app.models.memorial import Memorial
from app.models.store import Purchase, StoreItem


def apply_purchase_fulfillment(session: Session, purchase: Purchase) -> None:
    """Apply memorial-bound products exactly once after confirmed payment."""
    if purchase.status not in {PurchaseStatus.PAID, PurchaseStatus.ASSIGNED}:
        return

    item = session.get(StoreItem, purchase.store_item_id)
    if item is None:
        return

    payload = dict(purchase.assignment_payload or {})
    if payload.get("fulfilled") is True:
        return

    if item.kind == StoreItemKind.VERIFIED_BADGE:
        memorial = session.get(Memorial, purchase.memorial_id) if purchase.memorial_id else None
        if memorial is None:
            return
        memorial.is_verified = True
        memorial.verified_at = memorial.verified_at or utc_now()
        session.add(memorial)
        payload.update({"fulfilled": True, "badge": "VERIFIED", "fulfilled_at": utc_now().isoformat()})
        purchase.status = PurchaseStatus.ASSIGNED
    elif item.kind == StoreItemKind.CERAMIC_PLAQUE_SET:
        if purchase.memorial_id is None:
            return
        payload.update(
            {
                "fulfilled": True,
                "fulfillment_status": "PENDING_PRODUCTION",
                "components": ["PORTRAIT", "QR_CODE", "MEMORIAL_PAGE_ID"],
                "fulfilled_at": utc_now().isoformat(),
            }
        )
        purchase.status = PurchaseStatus.ASSIGNED
    else:
        # Account entitlements such as custom IDs are consumed lazily by their
        # existing entitlement workflow and must remain PAID until used.
        return

    purchase.assignment_payload = payload
    session.add(purchase)
