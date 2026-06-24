"""Add external auth fields to users.

Revision ID: 002_add_user_external_id
Revises: 001_initial_schema
Create Date: 2026-06-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_add_user_external_id"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    if "external_id" in existing_columns:
        return

    op.add_column("users", sa.Column("external_id", sa.String(length=255), nullable=True))
    op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=True)
    op.create_index("ix_users_external_id", "users", ["external_id"])
    op.create_unique_constraint("uq_users_external_id", "users", ["external_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_external_id", "users", type_="unique")
    op.drop_index("ix_users_external_id", table_name="users")
    op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=False)
    op.drop_column("users", "external_id")
