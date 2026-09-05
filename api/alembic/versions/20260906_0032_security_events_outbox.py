"""add durable security events and notification outbox"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260906_0032"
down_revision: str | None = "20260906_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    security_event_type = postgresql.ENUM(
        "fresh_login", "login_challenge", "failed_login", "refresh", "logout", "refresh_reuse_detected",
        name="security_event_type",
    )
    notification_channel = postgresql.ENUM("in_app", "email", name="notification_channel")
    outbox_status = postgresql.ENUM("pending", "processing", "delivered", "failed", name="notification_outbox_status")

    op.create_table(
        "security_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_key", sa.String(length=160), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("auth_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recognized_devices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", security_event_type, nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("event_key", name="uq_security_events_event_key"),
    )
    op.create_index("ix_security_events_user_id", "security_events", ["user_id"])
    op.create_index("ix_security_events_session_id", "security_events", ["session_id"])
    op.create_index("ix_security_events_device_id", "security_events", ["device_id"])
    op.create_index("ix_security_events_user_created", "security_events", ["user_id", "created_at"])
    op.create_index("ix_security_events_type_created", "security_events", ["event_type", "created_at"])

    op.create_table(
        "notification_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("security_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", notification_channel, nullable=False),
        sa.Column("status", outbox_status, nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("event_id", "channel", name="uq_notification_outbox_event_channel"),
    )
    op.create_index("ix_notification_outbox_event_id", "notification_outbox", ["event_id"])
    op.create_index("ix_notification_outbox_ready", "notification_outbox", ["status", "available_at"])

    op.add_column("notifications", sa.Column("security_event_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_notifications_security_event", "notifications", "security_events", ["security_event_id"], ["id"], ondelete="SET NULL")
    op.create_unique_constraint("uq_notifications_security_event_id", "notifications", ["security_event_id"])
    op.create_index("ix_notifications_security_event_id", "notifications", ["security_event_id"])
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'login_security'")


def downgrade() -> None:
    op.drop_index("ix_notifications_security_event_id", table_name="notifications")
    op.drop_constraint("uq_notifications_security_event_id", "notifications", type_="unique")
    op.drop_constraint("fk_notifications_security_event", "notifications", type_="foreignkey")
    op.drop_column("notifications", "security_event_id")
    op.drop_index("ix_notification_outbox_ready", table_name="notification_outbox")
    op.drop_index("ix_notification_outbox_event_id", table_name="notification_outbox")
    op.drop_table("notification_outbox")
    op.drop_index("ix_security_events_type_created", table_name="security_events")
    op.drop_index("ix_security_events_user_created", table_name="security_events")
    op.drop_index("ix_security_events_device_id", table_name="security_events")
    op.drop_index("ix_security_events_session_id", table_name="security_events")
    op.drop_index("ix_security_events_user_id", table_name="security_events")
    op.drop_table("security_events")
    op.execute("DROP TYPE IF EXISTS notification_outbox_status")
    op.execute("DROP TYPE IF EXISTS notification_channel")
    op.execute("DROP TYPE IF EXISTS security_event_type")
