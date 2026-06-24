"""Add append-only review events table.

Revision ID: 004_add_review_events
Revises: 003_add_review_metadata
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_add_review_events"
down_revision: Union[str, None] = "003_add_review_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "review_events",
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("decision", sa.String(length=32), nullable=False),
        sa.Column("subject_name", sa.String(length=255), nullable=True),
        sa.Column("memorial_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_id", sa.Uuid(), nullable=True),
        sa.Column("guestbook_entry_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["guestbook_entry_id"], ["guestbook_entries.id"]),
        sa.ForeignKeyConstraint(["memorial_id"], ["memorials.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_review_events_kind", "review_events", ["kind"])
    op.create_index("ix_review_events_memorial_id", "review_events", ["memorial_id"])
    op.create_index("ix_review_events_reviewer_id", "review_events", ["reviewer_id"])
    op.create_index("ix_review_events_guestbook_entry_id", "review_events", ["guestbook_entry_id"])


def downgrade() -> None:
    op.drop_index("ix_review_events_guestbook_entry_id", table_name="review_events")
    op.drop_index("ix_review_events_reviewer_id", table_name="review_events")
    op.drop_index("ix_review_events_memorial_id", table_name="review_events")
    op.drop_index("ix_review_events_kind", table_name="review_events")
    op.drop_table("review_events")
