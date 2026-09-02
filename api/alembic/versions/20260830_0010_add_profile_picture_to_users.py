"""add profile picture fields to users

Revision ID: 20260830_0010
Revises: 20260830_0009
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260830_0010"
down_revision: str | None = "20260830_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_picture_url", sa.String(length=2048), nullable=True))
    op.add_column("users", sa.Column("profile_picture_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_picture_updated_at")
    op.drop_column("users", "profile_picture_url")
