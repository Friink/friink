"""add chat request state, settings, blocks, and subscription tier

Revision ID: 20260902_0016
Revises: 20260901_0015
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260902_0016"
down_revision: str | None = "20260901_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'chat_request_received'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'chat_message'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'chat_request_accepted'")
    conversation_status = postgresql.ENUM("pending", "accepted", name="conversation_status")
    conversation_status.create(op.get_bind(), checkfirst=True)
    op.add_column("users", sa.Column("subscription_tier", sa.String(length=32), server_default="free", nullable=False))
    op.create_index("ix_users_subscription_tier", "users", ["subscription_tier"])
    op.add_column("conversations", sa.Column("status", conversation_status, server_default="accepted", nullable=False))
    op.add_column("conversations", sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("conversations", sa.Column("requester_message_count", sa.Integer(), server_default="0", nullable=False))
    op.create_foreign_key("fk_conversations_requester_id", "conversations", "users", ["requester_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_conversations_status", "conversations", ["status"])
    op.create_index("ix_conversations_requester_id", "conversations", ["requester_id"])
    op.create_table(
        "conversation_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("muted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("archived", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("explicitly_muted", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_conversation_settings_user"),
    )
    op.create_index("ix_conversation_settings_conversation_id", "conversation_settings", ["conversation_id"])
    op.create_index("ix_conversation_settings_user_id", "conversation_settings", ["user_id"])
    op.create_table(
        "user_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocked_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
    )
    op.create_index("ix_user_blocks_blocker_id", "user_blocks", ["blocker_id"])
    op.create_index("ix_user_blocks_blocked_id", "user_blocks", ["blocked_id"])


def downgrade() -> None:
    op.drop_index("ix_user_blocks_blocked_id", table_name="user_blocks")
    op.drop_index("ix_user_blocks_blocker_id", table_name="user_blocks")
    op.drop_table("user_blocks")
    op.drop_index("ix_conversation_settings_user_id", table_name="conversation_settings")
    op.drop_index("ix_conversation_settings_conversation_id", table_name="conversation_settings")
    op.drop_table("conversation_settings")
    op.drop_index("ix_conversations_requester_id", table_name="conversations")
    op.drop_index("ix_conversations_status", table_name="conversations")
    op.drop_constraint("fk_conversations_requester_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "requester_message_count")
    op.drop_column("conversations", "requester_id")
    op.drop_column("conversations", "status")
    op.drop_index("ix_users_subscription_tier", table_name="users")
    op.drop_column("users", "subscription_tier")
    sa.Enum(name="conversation_status").drop(op.get_bind(), checkfirst=True)
