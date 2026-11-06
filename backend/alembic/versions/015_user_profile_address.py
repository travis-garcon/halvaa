"""Add required profile address for store checkout completion.

Revision ID: 015_user_profile_address
Revises: 014_memorial_views_store_badges
Create Date: 2026-07-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015_user_profile_address"
down_revision: Union[str, None] = "014_memorial_views_store_badges"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("address", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "address")
