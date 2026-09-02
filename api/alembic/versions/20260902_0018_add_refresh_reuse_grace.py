"""add bounded refresh-token replay grace state

Revision ID: 20260902_0018
Revises: 20260902_0017
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260902_0018"
down_revision: str | None = "20260902_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("refresh_tokens", sa.Column("reuse_grace_used_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("refresh_tokens", "reuse_grace_used_at")
