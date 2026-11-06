"""Add deactivated memorial status and package store kind.

Revision ID: 013_deactivated_packages_translation_status
Revises: 012_user_profile_completion
Create Date: 2026-06-30

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013_deactivated_packages_translation_status"
down_revision: Union[str, None] = "012_user_profile_completion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("alembic_version", "version_num", existing_type=sa.String(length=32), type_=sa.String(length=128))
    # Enums are stored as VARCHAR by SQLAlchemy native_enum=False, so no DDL is
    # required for PostgreSQL. This revision documents the application-level
    # values used after deployment.


def downgrade() -> None:
    op.alter_column("alembic_version", "version_num", existing_type=sa.String(length=128), type_=sa.String(length=32))
