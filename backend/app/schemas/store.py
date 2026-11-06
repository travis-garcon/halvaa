from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import PaymentProvider


class StoreItemPublic(BaseModel):
    id: UUID
    key: str
    kind: str
    title: dict[str, str]
    description: dict[str, str]
    price_usd_cents: int
    price_irr: int
    item_metadata: dict[str, Any] = Field(default_factory=dict)


class CheckoutCreate(BaseModel):
    store_item_id: UUID
    memorial_id: UUID | None = None
    locale: str = "en"
    country_code: str | None = None
    provider: PaymentProvider | None = None


class CheckoutResponse(BaseModel):
    provider: str
    purchase_id: str
    amount: int
    currency: str
    checkout_url: str
    provider_reference: str | None = None
    test_mode: bool = False


class PaymentVerifyResponse(BaseModel):
    purchase_id: UUID
    status: str
    provider: str
    provider_reference: str | None = None
    message: str


class PurchasePublic(BaseModel):
    id: UUID
    store_item_id: UUID
    memorial_id: UUID | None = None
    status: str
    provider: str
    amount: int
    currency: str
    created_at: datetime

    model_config = {"from_attributes": True}
