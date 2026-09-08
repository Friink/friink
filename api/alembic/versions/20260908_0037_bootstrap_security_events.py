"""add reserved superadmin bootstrap security event types"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260908_0037"
down_revision: str | None = "20260908_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'bootstrap_succeeded'")
    op.execute("ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'bootstrap_refused'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely in-place. These values
    # remain harmless if this migration is downgraded.
    pass
