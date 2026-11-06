"""Add memorial metadata and filter tags.

Revision ID: 010_add_memorial_metadata_tags
Revises: 009_auth_store_admin_public_ids
Create Date: 2026-06-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010_add_memorial_metadata_tags"
down_revision: Union[str, None] = "009_auth_store_admin_public_ids"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("memorials", sa.Column("category", sa.String(length=80), nullable=True))
    op.add_column("memorials", sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False))
    op.add_column("memorials", sa.Column("filter_tags", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False))
    op.create_index("ix_memorials_category", "memorials", ["category"])


def downgrade() -> None:
    op.drop_index("ix_memorials_category", table_name="memorials")
    op.drop_column("memorials", "filter_tags")
    op.drop_column("memorials", "metadata")
    op.drop_column("memorials", "category")
