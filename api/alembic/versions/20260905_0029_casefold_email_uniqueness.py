"""enforce case-insensitive email uniqueness at the database boundary"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260905_0029"
down_revision: str | None = "20260905_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE UNIQUE INDEX uq_users_email_casefold ON users (lower(email))")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_email_casefold")
