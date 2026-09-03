"""add delivery-independent signup reservations"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260903_0021"
down_revision: str | None = "20260903_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "signup_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("username_key", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_signup_reservations_email", "signup_reservations", ["email"])
    op.create_index("ix_signup_reservations_username_key", "signup_reservations", ["username_key"])
    op.add_column("otp_codes", sa.Column("signup_reservation_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.alter_column("otp_codes", "user_id", nullable=True)
    op.create_foreign_key("fk_otp_codes_signup_reservation", "otp_codes", "signup_reservations", ["signup_reservation_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_otp_codes_signup_reservation_id", "otp_codes", ["signup_reservation_id"])


def downgrade() -> None:
    op.drop_index("ix_otp_codes_signup_reservation_id", table_name="otp_codes")
    op.drop_constraint("fk_otp_codes_signup_reservation", "otp_codes", type_="foreignkey")
    op.alter_column("otp_codes", "user_id", nullable=False)
    op.drop_column("otp_codes", "signup_reservation_id")
    op.drop_index("ix_signup_reservations_username_key", table_name="signup_reservations")
    op.drop_index("ix_signup_reservations_email", table_name="signup_reservations")
    op.drop_table("signup_reservations")
