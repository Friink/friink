"""record password reset purpose"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260909_0040"
down_revision: str | None = "20260908_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "password_reset_tokens",
        sa.Column("purpose", sa.String(length=24), server_default=sa.text("'ordinary'"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("password_reset_tokens", "purpose")
