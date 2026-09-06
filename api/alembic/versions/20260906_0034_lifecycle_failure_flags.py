"""Add operational failure flags for account deletion."""

from alembic import op
import sqlalchemy as sa

revision = "20260906_0034"
down_revision = "20260906_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("deletion_failure_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_failure_reason", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "deletion_failure_reason")
    op.drop_column("users", "deletion_failure_at")
