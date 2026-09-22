"""add subscription access notification types"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260922_0052"
down_revision: str | None = "20260917_0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for value in ("subscription_access_granted", "subscription_access_changed", "subscription_access_revoked"):
        op.execute(sa.text(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'"))


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely without recreating the
    # type, and existing notification rows may already use these values.
    pass
