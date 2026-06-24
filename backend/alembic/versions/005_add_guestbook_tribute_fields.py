"""Add tribute metadata to guestbook entries.

Revision ID: 005_add_guestbook_tribute_fields
Revises: 004_add_review_events
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_add_guestbook_tribute_fields"
down_revision: Union[str, None] = "004_add_review_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "guestbook_entries",
        sa.Column("tribute_type", sa.String(length=32), nullable=False, server_default="MESSAGE"),
    )
    op.add_column(
        "guestbook_entries",
        sa.Column("relationship_label", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("guestbook_entries", "relationship_label")
    op.drop_column("guestbook_entries", "tribute_type")
