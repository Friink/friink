"""add user security epoch for deliberate session invalidation"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260909_0041"
down_revision: str | None = "20260909_0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("security_epoch", sa.Integer(), server_default=sa.text("0"), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "security_epoch")
