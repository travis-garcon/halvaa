"""Initial schema with PostGIS, workflow enums, RBAC, and JSONB translations.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-06-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_external_id", "users", ["external_id"])

    op.create_table(
        "memorials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "PENDING_APPROVAL",
                "PUBLISHED",
                "FEATURED",
                name="memorial_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("death_date", sa.Date(), nullable=True),
        sa.Column("burial_address", sa.String(length=512), nullable=True),
        sa.Column("qr_code_url", sa.String(length=2048), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("featured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "translations",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "theme_overrides",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default='{"--color-primary": "#FF6B00"}',
            nullable=False,
        ),
        sa.Column(
            "burial_location",
            Geography(geometry_type="POINT", srid=4326),
            nullable=True,
        ),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_memorials_slug", "memorials", ["slug"])
    op.create_index("ix_memorials_status", "memorials", ["status"])
    op.create_index("ix_memorials_created_by_id", "memorials", ["created_by_id"])
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_memorials_burial_location '
        'ON memorials USING gist (burial_location)'
    )

    op.create_table(
        "memorial_collaborators",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "role",
            sa.Enum("OWNER", "EDITOR", "VIEWER", name="collaborator_role", native_enum=False),
            nullable=False,
        ),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("memorial_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("memorial_id", "user_id", name="uq_memorial_collaborator"),
    )
    op.create_index("ix_memorial_collaborators_role", "memorial_collaborators", ["role"])
    op.create_index(
        "ix_memorial_collaborators_memorial_id",
        "memorial_collaborators",
        ["memorial_id"],
    )
    op.create_index(
        "ix_memorial_collaborators_user_id",
        "memorial_collaborators",
        ["user_id"],
    )

    op.create_table(
        "media_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "media_type",
            sa.Enum("IMAGE", "VIDEO", "DOCUMENT", name="media_type", native_enum=False),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.Enum(
                "GALLERY",
                "TIMELINE",
                "DOCUMENT",
                "WILL",
                "AVATAR",
                name="media_category",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("original_storage_key", sa.String(length=1024), nullable=False),
        sa.Column("thumbnail_storage_key", sa.String(length=1024), nullable=True),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "processing_status",
            sa.Enum(
                "PENDING",
                "COMPLETED",
                "FAILED",
                name="media_processing_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "translations",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("memorial_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_media_assets_media_type", "media_assets", ["media_type"])
    op.create_index("ix_media_assets_category", "media_assets", ["category"])
    op.create_index("ix_media_assets_sort_order", "media_assets", ["sort_order"])
    op.create_index(
        "ix_media_assets_processing_status",
        "media_assets",
        ["processing_status"],
    )
    op.create_index("ix_media_assets_memorial_id", "media_assets", ["memorial_id"])

    op.create_table(
        "timeline_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "BIOGRAPHY",
                "LIFE_EVENT",
                "LOCATION",
                name="timeline_event_type",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=True),
        sa.Column(
            "translations",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "location_point",
            Geography(geometry_type="POINT", srid=4326),
            nullable=True,
        ),
        sa.Column("memorial_id", sa.Uuid(), nullable=False),
        sa.Column("media_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["media_id"], ["media_assets.id"]),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timeline_events_event_type", "timeline_events", ["event_type"])
    op.create_index("ix_timeline_events_sort_order", "timeline_events", ["sort_order"])
    op.create_index("ix_timeline_events_memorial_id", "timeline_events", ["memorial_id"])
    op.create_index("ix_timeline_events_media_id", "timeline_events", ["media_id"])
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_timeline_events_location_point '
        'ON timeline_events USING gist (location_point)'
    )

    op.create_table(
        "guestbook_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("author_name", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "APPROVED",
                "REJECTED",
                name="guestbook_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("memorial_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("moderated_by_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.ForeignKeyConstraint(["moderated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_guestbook_entries_status", "guestbook_entries", ["status"])
    op.create_index("ix_guestbook_entries_memorial_id", "guestbook_entries", ["memorial_id"])
    op.create_index(
        "ix_guestbook_entries_author_user_id",
        "guestbook_entries",
        ["author_user_id"],
    )
    op.create_index(
        "ix_guestbook_entries_moderated_by_id",
        "guestbook_entries",
        ["moderated_by_id"],
    )


def downgrade() -> None:
    op.drop_table("guestbook_entries")
    op.drop_table("timeline_events")
    op.drop_table("media_assets")
    op.drop_table("memorial_collaborators")
    op.drop_table("memorials")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS postgis")
