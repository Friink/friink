"""add canonical identity, history, and reserved usernames"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260903_0019"
down_revision: str | None = "20260902_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username_key", sa.String(length=64), nullable=True))
    op.execute("UPDATE users SET username_key = lower(username) WHERE username_key IS NULL")
    op.alter_column("users", "username_key", nullable=False)
    op.drop_index("uq_users_username_lower", table_name="users")
    op.create_index("uq_users_username_key", "users", ["username_key"], unique=True)

    op.create_table(
        "user_email_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email_value", sa.String(length=320), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_email_history_user_id", "user_email_history", ["user_id"])
    op.create_table(
        "user_username_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username_key", sa.String(length=64), nullable=False),
        sa.Column("username_display", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_username_history_user_id", "user_username_history", ["user_id"])
    op.create_index("ix_user_username_history_username_key", "user_username_history", ["username_key"])
    op.create_table(
        "reserved_usernames",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username_key", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.String(length=120), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username_key"),
    )
    op.execute(
        """
        INSERT INTO reserved_usernames (id, username_key, reason) VALUES
        ('00000000-0000-0000-0000-000000000001', 'admin', 'system'),
        ('00000000-0000-0000-0000-000000000002', 'staff', 'system'),
        ('00000000-0000-0000-0000-000000000003', 'media', 'system'),
        ('00000000-0000-0000-0000-000000000004', 'support', 'system'),
        ('00000000-0000-0000-0000-000000000005', 'security', 'system')
        """
    )


def downgrade() -> None:
    op.drop_table("reserved_usernames")
    op.drop_index("ix_user_username_history_username_key", table_name="user_username_history")
    op.drop_index("ix_user_username_history_user_id", table_name="user_username_history")
    op.drop_table("user_username_history")
    op.drop_index("ix_user_email_history_user_id", table_name="user_email_history")
    op.drop_table("user_email_history")
    op.drop_index("uq_users_username_key", table_name="users")
    op.drop_column("users", "username_key")
    op.create_index("uq_users_username_lower", "users", [sa.text("lower(username)")], unique=True)
