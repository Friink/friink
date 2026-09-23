"""allow membership-backed group conversations alongside direct chats"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260924_0058"
down_revision: str | None = "20260924_0057"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_conversations_user_pair", "conversations", type_="unique")
    op.drop_constraint("ck_conversations_not_self", "conversations", type_="check")
    op.alter_column("conversations", "user_one_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.alter_column("conversations", "user_two_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.create_check_constraint(
        "ck_conversations_type_pair_columns",
        "conversations",
        "(conversation_type = 'direct' AND user_one_id IS NOT NULL AND user_two_id IS NOT NULL AND user_one_id <> user_two_id) OR "
        "(conversation_type = 'group' AND user_one_id IS NULL AND user_two_id IS NULL)",
    )
    op.create_index(
        "uq_conversations_direct_user_pair",
        "conversations",
        ["user_one_id", "user_two_id"],
        unique=True,
        postgresql_where=sa.text("conversation_type = 'direct'"),
    )


def downgrade() -> None:
    connection = op.get_bind()
    groups_exist = connection.scalar(sa.text("SELECT EXISTS (SELECT 1 FROM conversations WHERE conversation_type = 'group')"))
    if groups_exist:
        raise RuntimeError("Cannot downgrade while group conversations exist.")
    op.drop_index("uq_conversations_direct_user_pair", table_name="conversations")
    op.drop_constraint("ck_conversations_type_pair_columns", "conversations", type_="check")
    op.alter_column("conversations", "user_one_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.alter_column("conversations", "user_two_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.create_check_constraint("ck_conversations_not_self", "conversations", "user_one_id <> user_two_id")
    op.create_unique_constraint("uq_conversations_user_pair", "conversations", ["user_one_id", "user_two_id"])
