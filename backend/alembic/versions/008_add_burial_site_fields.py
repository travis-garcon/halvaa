"""Add burial site and plot fields to memorials.

Revision ID: 008_add_burial_site_fields
Revises: 007_add_memorial_family_tree
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_add_burial_site_fields"
down_revision: Union[str, None] = "007_add_memorial_family_tree"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("memorials", sa.Column("burial_site_name", sa.String(length=255), nullable=True))
    op.add_column("memorials", sa.Column("burial_plot_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("memorials", "burial_plot_name")
    op.drop_column("memorials", "burial_site_name")
