"""create follow requests

Revision ID: 20260828_0003
Revises: 20260828_0002
Create Date: 2026-08-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260828_0003"
down_revision: str | None = "20260828_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    follow_request_status = postgresql.ENUM(
        "pending",
        "accepted",
        "rejected",
        "canceled",
        name="follow_request_status",
        create_type=False,
    )
    follow_request_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "follow_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", follow_request_status, server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("requester_id <> recipient_id", name="ck_follow_requests_not_self"),
    )
    op.create_index("ix_follow_requests_requester_id", "follow_requests", ["requester_id"], unique=False)
    op.create_index("ix_follow_requests_recipient_id", "follow_requests", ["recipient_id"], unique=False)
    op.create_index(
        "uq_follow_requests_pending_pair",
        "follow_requests",
        ["requester_id", "recipient_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index(
        "uq_follow_requests_accepted_pair",
        "follow_requests",
        ["requester_id", "recipient_id"],
        unique=True,
        postgresql_where=sa.text("status = 'accepted'"),
    )


def downgrade() -> None:
    op.drop_index("uq_follow_requests_accepted_pair", table_name="follow_requests")
    op.drop_index("uq_follow_requests_pending_pair", table_name="follow_requests")
    op.drop_index("ix_follow_requests_recipient_id", table_name="follow_requests")
    op.drop_index("ix_follow_requests_requester_id", table_name="follow_requests")
    op.drop_table("follow_requests")
    postgresql.ENUM(name="follow_request_status").drop(op.get_bind(), checkfirst=True)
