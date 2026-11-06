"""Add user profile completion and locked sign-in fields.

Revision ID: 012_user_profile_completion
Revises: 011_verified_locations
Create Date: 2026-06-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_user_profile_completion"
down_revision: Union[str, None] = "011_verified_locations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_completed", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("users", sa.Column("locked_email", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("users", sa.Column("locked_phone_number", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "locked_phone_number")
    op.drop_column("users", "locked_email")
    op.drop_column("users", "profile_completed")
