"""Add memorial verified badge and structured locations.

Revision ID: 011_verified_locations
Revises: 010_add_memorial_metadata_tags
Create Date: 2026-06-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011_verified_locations"
down_revision: Union[str, None] = "010_add_memorial_metadata_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("memorials", sa.Column("is_verified", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("memorials", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("memorials", sa.Column("locations", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False))
    op.create_index("ix_memorials_is_verified", "memorials", ["is_verified"])


def downgrade() -> None:
    op.drop_index("ix_memorials_is_verified", table_name="memorials")
    op.drop_column("memorials", "locations")
    op.drop_column("memorials", "verified_at")
    op.drop_column("memorials", "is_verified")
