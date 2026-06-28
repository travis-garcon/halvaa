"""Add OTP auth, store, admin placements, and public IDs.

Revision ID: 009_auth_store_admin_public_ids
Revises: 008_add_burial_site_fields
Create Date: 2026-06-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009_auth_store_admin_public_ids"
down_revision: Union[str, None] = "008_add_burial_site_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=16), nullable=False, server_default="USER"))
    op.add_column("users", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_phone_number", "users", ["phone_number"])

    op.add_column("memorials", sa.Column("public_id", sa.String(length=64), nullable=True))
    op.execute("UPDATE memorials SET public_id = slug WHERE public_id IS NULL")
    op.alter_column("memorials", "public_id", nullable=False)
    op.create_index("ix_memorials_public_id", "memorials", ["public_id"], unique=True)

    op.create_table(
        "auth_otps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("phone_number", sa.String(length=32), nullable=True),
        sa.Column("sms_provider", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("requested_by_ip", sa.String(length=64), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_otps_email", "auth_otps", ["email"])
    op.create_index("ix_auth_otps_expires_at", "auth_otps", ["expires_at"])
    op.create_index("ix_auth_otps_consumed_at", "auth_otps", ["consumed_at"])
    op.create_index("ix_auth_otps_user_id", "auth_otps", ["user_id"])

    op.create_table(
        "store_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("title", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("description", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("price_usd_cents", sa.Integer(), nullable=False),
        sa.Column("price_irr", sa.Integer(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_store_items_key", "store_items", ["key"], unique=True)
    op.create_index("ix_store_items_kind", "store_items", ["kind"])
    op.create_index("ix_store_items_is_active", "store_items", ["is_active"])

    op.create_table(
        "purchases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("memorial_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("provider_reference", sa.String(length=255), nullable=True),
        sa.Column("assignment_payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.ForeignKeyConstraint(["store_item_id"], ["store_items.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_purchases_user_id", "purchases", ["user_id"])
    op.create_index("ix_purchases_store_item_id", "purchases", ["store_item_id"])
    op.create_index("ix_purchases_memorial_id", "purchases", ["memorial_id"])
    op.create_index("ix_purchases_status", "purchases", ["status"])
    op.create_index("ix_purchases_provider", "purchases", ["provider"])
    op.create_index("ix_purchases_provider_reference", "purchases", ["provider_reference"])

    op.create_table(
        "landing_memorial_placements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("memorial_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_landing_memorial_placements_memorial_id", "landing_memorial_placements", ["memorial_id"])
    op.create_index("ix_landing_memorial_placements_category", "landing_memorial_placements", ["category"])
    op.create_index("ix_landing_memorial_placements_sort_order", "landing_memorial_placements", ["sort_order"])
    op.create_index("ix_landing_memorial_placements_is_active", "landing_memorial_placements", ["is_active"])

    op.create_table(
        "memorial_contributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("memorial_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contributor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("contribution_type", sa.String(length=48), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("reviewer_note", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["contributor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_memorial_contributions_memorial_id", "memorial_contributions", ["memorial_id"])
    op.create_index("ix_memorial_contributions_contributor_id", "memorial_contributions", ["contributor_id"])
    op.create_index("ix_memorial_contributions_reviewed_by_id", "memorial_contributions", ["reviewed_by_id"])
    op.create_index("ix_memorial_contributions_contribution_type", "memorial_contributions", ["contribution_type"])
    op.create_index("ix_memorial_contributions_status", "memorial_contributions", ["status"])


def downgrade() -> None:
    op.drop_table("memorial_contributions")
    op.drop_table("landing_memorial_placements")
    op.drop_table("purchases")
    op.drop_table("store_items")
    op.drop_table("auth_otps")
    op.drop_index("ix_memorials_public_id", table_name="memorials")
    op.drop_column("memorials", "public_id")
    op.drop_index("ix_users_phone_number", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "role")
