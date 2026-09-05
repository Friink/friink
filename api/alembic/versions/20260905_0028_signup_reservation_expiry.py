"""add signup reservation expiry"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260905_0028"
down_revision: str | None = "20260905_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "signup_reservations",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE signup_reservations SET expires_at = created_at + interval '30 minutes' WHERE expires_at IS NULL"
    )
    op.alter_column("signup_reservations", "expires_at", nullable=False)


def downgrade() -> None:
    op.drop_column("signup_reservations", "expires_at")
