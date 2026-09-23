"""add chat message media"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260923_0054"
down_revision: str | None = "20260923_0053"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "message_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_message_media_message_id", "message_media", ["message_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_message_media_message_id", table_name="message_media")
    op.drop_table("message_media")
