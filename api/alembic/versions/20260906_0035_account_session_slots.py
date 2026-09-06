"""add device-scoped account session slots"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260906_0035"
down_revision = "20260906_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_session_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("slot_token_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("auth_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("auth_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slot_token_hash", name="uq_account_session_slots_token"),
        sa.UniqueConstraint("auth_session_id", name="uq_account_session_slots_auth_session"),
    )
    op.create_index("ix_account_session_slots_user_id", "account_session_slots", ["user_id"])
    op.create_index("ix_account_session_slots_device_active", "account_session_slots", ["device_hash", "revoked_at"])


def downgrade() -> None:
    op.drop_index("ix_account_session_slots_device_active", table_name="account_session_slots")
    op.drop_index("ix_account_session_slots_user_id", table_name="account_session_slots")
    op.drop_table("account_session_slots")
