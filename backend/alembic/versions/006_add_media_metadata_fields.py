"""Add media metadata fields for artifacts and documents.

Revision ID: 006_add_media_metadata_fields
Revises: 005_add_guestbook_tribute_fields
Create Date: 2026-06-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_add_media_metadata_fields"
down_revision: Union[str, None] = "005_add_guestbook_tribute_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("media_assets", sa.Column("title", sa.String(length=255), nullable=True))
    op.add_column("media_assets", sa.Column("description", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column("media_assets", "description")
    op.drop_column("media_assets", "title")
