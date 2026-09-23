"""add saved profiles"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260923_0053"
down_revision: str | None = "20260922_0052"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profile_saves",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "user_id", name="uq_profile_saves_profile_user"),
    )
    op.create_index("ix_profile_saves_user_created", "profile_saves", ["user_id", "created_at"], unique=False)
    op.create_index("ix_profile_saves_profile_created", "profile_saves", ["profile_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_profile_saves_profile_created", table_name="profile_saves")
    op.drop_index("ix_profile_saves_user_created", table_name="profile_saves")
    op.drop_table("profile_saves")
