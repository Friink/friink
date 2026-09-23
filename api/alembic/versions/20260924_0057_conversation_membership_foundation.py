"""add conversation type and membership foundation"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260924_0057"
down_revision: str | None = "20260923_0056"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


conversation_type = postgresql.ENUM("direct", "group", name="conversation_type")


def upgrade() -> None:
    conversation_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "conversations",
        sa.Column("conversation_type", conversation_type, nullable=False, server_default="direct"),
    )
    op.create_index("ix_conversations_conversation_type", "conversations", ["conversation_type"])

    op.create_table(
        "conversation_members",
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("conversation_id", "user_id"),
    )
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])

    op.execute(
        sa.text(
            """
            INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
            SELECT c.id, member.user_id, 'member', c.created_at
            FROM conversations AS c
            CROSS JOIN LATERAL (
                VALUES (c.user_one_id), (c.user_two_id)
            ) AS member(user_id)
            ON CONFLICT (conversation_id, user_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_conversation_members_user_id", table_name="conversation_members")
    op.drop_table("conversation_members")
    op.drop_index("ix_conversations_conversation_type", table_name="conversations")
    op.drop_column("conversations", "conversation_type")
    conversation_type.drop(op.get_bind(), checkfirst=True)
