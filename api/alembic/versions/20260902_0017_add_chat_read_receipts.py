"""add chat read receipt cursors and privacy setting

Revision ID: 20260902_0017
Revises: 20260902_0016
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260902_0017"
down_revision: str | None = "20260902_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("read_receipts_enabled", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("conversation_settings", sa.Column("last_delivered_message_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("conversation_settings", sa.Column("last_read_message_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_conversation_settings_last_delivered_message_id", "conversation_settings", "messages", ["last_delivered_message_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_conversation_settings_last_read_message_id", "conversation_settings", "messages", ["last_read_message_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_conversation_settings_last_read_message_id", "conversation_settings", type_="foreignkey")
    op.drop_constraint("fk_conversation_settings_last_delivered_message_id", "conversation_settings", type_="foreignkey")
    op.drop_column("conversation_settings", "last_read_message_id")
    op.drop_column("conversation_settings", "last_delivered_message_id")
    op.drop_column("users", "read_receipts_enabled")
