"""add email ownership-change requests"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260905_0027"
down_revision: str | None = "20260905_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "email_change_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("new_email", sa.String(length=320), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_email_change_requests_user_id", "email_change_requests", ["user_id"])
    op.add_column(
        "otp_codes",
        sa.Column("email_change_request_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_otp_codes_email_change_request_id",
        "otp_codes",
        "email_change_requests",
        ["email_change_request_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_otp_codes_email_change_request_id", "otp_codes", ["email_change_request_id"])


def downgrade() -> None:
    op.drop_index("ix_otp_codes_email_change_request_id", table_name="otp_codes")
    op.drop_constraint("fk_otp_codes_email_change_request_id", "otp_codes", type_="foreignkey")
    op.drop_column("otp_codes", "email_change_request_id")
    op.drop_index("ix_email_change_requests_user_id", table_name="email_change_requests")
    op.drop_table("email_change_requests")
