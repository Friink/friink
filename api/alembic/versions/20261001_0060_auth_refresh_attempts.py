"""persist redacted refresh-attempt diagnostics"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261001_0060"
down_revision: str | None = "20260925_0059"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auth_refresh_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("refresh_operation_id", sa.String(length=128), nullable=True),
        sa.Column("client_tab_id_hash", sa.String(length=64), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("auth_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("account_slot_hash", sa.String(length=64), nullable=True),
        sa.Column("result", sa.String(length=32), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("failure_class", sa.String(length=32), nullable=True),
        sa.Column("exception_type", sa.String(length=128), nullable=True),
        sa.Column("deployment_sha", sa.String(length=128), nullable=False),
        sa.Column("slot_header_present", sa.Boolean(), nullable=False),
        sa.Column("expected_slot_cookie_present", sa.Boolean(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("request_id", name="uq_auth_refresh_attempts_request_id"),
    )
    op.create_index("ix_auth_refresh_attempts_created_at", "auth_refresh_attempts", ["created_at"])
    op.create_index("ix_auth_refresh_attempts_operation_id", "auth_refresh_attempts", ["refresh_operation_id"])
    op.create_index("ix_auth_refresh_attempts_session_created", "auth_refresh_attempts", ["session_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_refresh_attempts_session_created", table_name="auth_refresh_attempts")
    op.drop_index("ix_auth_refresh_attempts_operation_id", table_name="auth_refresh_attempts")
    op.drop_index("ix_auth_refresh_attempts_created_at", table_name="auth_refresh_attempts")
    op.drop_table("auth_refresh_attempts")
