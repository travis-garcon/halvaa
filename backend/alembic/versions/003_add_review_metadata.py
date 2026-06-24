"""Add review metadata to memorials and guestbook entries.

Revision ID: 003_add_review_metadata
Revises: 002_add_user_external_id
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_review_metadata"
down_revision: Union[str, None] = "002_add_user_external_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("memorials", sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("memorials", sa.Column("last_review_decision", sa.String(length=32), nullable=True))
    op.add_column("memorials", sa.Column("last_reviewed_by_id", sa.Uuid(), nullable=True))
    op.create_index("ix_memorials_last_reviewed_by_id", "memorials", ["last_reviewed_by_id"])
    op.create_foreign_key(
        "fk_memorials_last_reviewed_by_id_users",
        "memorials",
        "users",
        ["last_reviewed_by_id"],
        ["id"],
    )

    op.add_column("guestbook_entries", sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("guestbook_entries", "moderated_at")

    op.drop_constraint("fk_memorials_last_reviewed_by_id_users", "memorials", type_="foreignkey")
    op.drop_index("ix_memorials_last_reviewed_by_id", table_name="memorials")
    op.drop_column("memorials", "last_reviewed_by_id")
    op.drop_column("memorials", "last_review_decision")
    op.drop_column("memorials", "last_reviewed_at")
