"""record the key id used for deterministic refresh successors"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260925_0059"
down_revision: str | None = "20260924_0058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column("derivation_key_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("rotation_operation_id", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "rotation_operation_id")
    op.drop_column("refresh_tokens", "derivation_key_id")
