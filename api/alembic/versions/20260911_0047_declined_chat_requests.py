"""add declined chat request state

Revision ID: 20260911_0047
Revises: 20260911_0046
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260911_0047"
down_revision: str | None = "20260911_0046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'declined'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place.
    pass
