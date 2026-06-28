import uuid
from typing import Any

from sqlalchemy import Column, Enum as SAEnum, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentProvider, PurchaseStatus, StoreItemKind


class StoreItem(UUIDPrimaryKeyMixin, TimestampMixin, table=True):
    __tablename__ = "store_items"

    key: str = Field(index=True, unique=True, max_length=80)
    kind: StoreItemKind = Field(
        sa_column=Column(SAEnum(StoreItemKind, name="store_item_kind", native_enum=False), nullable=False, index=True),
    )
    title: dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    description: dict[str, str] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    price_usd_cents: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    price_irr: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    item_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"))
    is_active: bool = Field(default=True, index=True)


class Purchase(UUIDPrimaryKeyMixin, TimestampMixin, table=True):
    __tablename__ = "purchases"

    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    store_item_id: uuid.UUID = Field(foreign_key="store_items.id", index=True, nullable=False)
    memorial_id: uuid.UUID | None = Field(default=None, foreign_key="memorials.id", index=True)
    status: PurchaseStatus = Field(
        default=PurchaseStatus.PENDING,
        sa_column=Column(SAEnum(PurchaseStatus, name="purchase_status", native_enum=False), nullable=False, index=True),
    )
    provider: PaymentProvider = Field(
        sa_column=Column(SAEnum(PaymentProvider, name="payment_provider", native_enum=False), nullable=False, index=True),
    )
    amount: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    currency: str = Field(default="USD", max_length=8)
    provider_reference: str | None = Field(default=None, max_length=255, index=True)
    assignment_payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))


class LandingMemorialPlacement(UUIDPrimaryKeyMixin, TimestampMixin, table=True):
    __tablename__ = "landing_memorial_placements"

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)
    category: str = Field(default="featured", index=True, max_length=64)
    sort_order: int = Field(default=0, index=True)
    is_active: bool = Field(default=True, index=True)
    label: str | None = Field(default=None, sa_column=Column(String(length=120), nullable=True))
