"""add mention notification type

Revision ID: 20260901_0012
Revises: 20260831_0011
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260901_0012"
down_revision: str | None = "20260831_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'mention'")


def downgrade() -> None:
    # PostgreSQL does not support removing one value from an enum safely while
    # preserving existing rows; the application can continue to read this value.
    pass
