"""allow email-first signup OTP reservations"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260905_0025"
down_revision: str | None = "20260904_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("signup_reservations", "username", existing_type=sa.String(length=64), nullable=True)
    op.alter_column("signup_reservations", "username_key", existing_type=sa.String(length=64), nullable=True)
    op.alter_column("signup_reservations", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.alter_column("signup_reservations", "date_of_birth", existing_type=sa.Date(), nullable=True)
    op.add_column("signup_reservations", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("signup_reservations", "email_verified_at")
    op.alter_column("signup_reservations", "date_of_birth", existing_type=sa.Date(), nullable=False)
    op.alter_column("signup_reservations", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("signup_reservations", "username_key", existing_type=sa.String(length=64), nullable=False)
    op.alter_column("signup_reservations", "username", existing_type=sa.String(length=64), nullable=False)
