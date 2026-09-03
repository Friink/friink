"""add server-managed recognized devices"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260903_0022"
down_revision: str | None = "20260903_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recognized_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("browser", sa.String(length=120), nullable=True),
        sa.Column("operating_system", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "token_hash", name="uq_recognized_devices_user_token"),
    )
    op.create_index("ix_recognized_devices_user_id", "recognized_devices", ["user_id"])
    op.add_column("auth_sessions", sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_auth_sessions_device_id",
        "auth_sessions",
        "recognized_devices",
        ["device_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_auth_sessions_device_id", "auth_sessions", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_device_id", table_name="auth_sessions")
    op.drop_constraint("fk_auth_sessions_device_id", "auth_sessions", type_="foreignkey")
    op.drop_column("auth_sessions", "device_id")
    op.drop_index("ix_recognized_devices_user_id", table_name="recognized_devices")
    op.drop_table("recognized_devices")
