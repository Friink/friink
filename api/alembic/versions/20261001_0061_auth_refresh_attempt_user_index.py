"""add user index for refresh-attempt diagnostics"""

from collections.abc import Sequence

from alembic import op


revision: str = "20261001_0061"
down_revision: str | None = "20261001_0060"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_auth_refresh_attempts_user_id", "auth_refresh_attempts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_refresh_attempts_user_id", table_name="auth_refresh_attempts")
