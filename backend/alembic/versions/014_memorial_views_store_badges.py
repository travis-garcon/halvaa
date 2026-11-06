"""Add persisted memorial view counts for popularity badges.

Revision ID: 014_memorial_views_store_badges
Revises: 013_deactivated_packages_translation_status
Create Date: 2026-07-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "014_memorial_views_store_badges"
down_revision: Union[str, None] = "013_deactivated_packages_translation_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "memorials",
        sa.Column("view_count", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.create_index("ix_memorials_view_count", "memorials", ["view_count"])


def downgrade() -> None:
    op.drop_index("ix_memorials_view_count", table_name="memorials")
    op.drop_column("memorials", "view_count")
