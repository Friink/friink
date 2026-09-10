"""replace progressive failed-login cooldown policy"""

from alembic import op
import sqlalchemy as sa


revision = "20260910_0043"
down_revision = "20260910_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("failed_login_last_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "login_ip_throttles",
        sa.Column("key_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("key_hash"),
    )


def downgrade() -> None:
    op.drop_table("login_ip_throttles")
    op.drop_column("users", "failed_login_last_at")
