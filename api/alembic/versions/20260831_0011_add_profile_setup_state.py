"""add persisted profile setup state to users

Revision ID: 20260831_0011
Revises: 20260830_0010
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260831_0011"
down_revision: str | None = "20260830_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("setup_step", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("users", sa.Column("setup_completed", sa.Boolean(), nullable=False, server_default="true"))
    op.execute(sa.text("UPDATE users SET setup_completed = true"))
    op.alter_column("users", "setup_completed", server_default="false")


def downgrade() -> None:
    op.drop_column("users", "setup_completed")
    op.drop_column("users", "setup_step")
