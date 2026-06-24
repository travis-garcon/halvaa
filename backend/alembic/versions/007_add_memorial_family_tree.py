"""Add family tree data to memorials.

Revision ID: 007_add_memorial_family_tree
Revises: 006_add_media_metadata_fields
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007_add_memorial_family_tree"
down_revision: Union[str, None] = "006_add_media_metadata_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "memorials",
        sa.Column("family_tree", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("memorials", "family_tree")
