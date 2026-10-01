"""remove dedicated account-slot table after switching to auth sessions"""

from collections.abc import Sequence

from alembic import op


revision: str = "20261002_0062"
down_revision: str | None = "20261001_0061"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("account_session_slots")


def downgrade() -> None:
    raise RuntimeError("The dedicated account-session-slot table is intentionally retired.")
