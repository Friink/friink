"""replace plaintext OTP storage with hashes and attempt limits"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260903_0020"
down_revision: str | None = "20260903_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for value in ("email_change", "password_recovery", "device_enrollment", "staff_access"):
        op.execute(f"ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS '{value}'")
    op.add_column("otp_codes", sa.Column("otp_hash", sa.LargeBinary(length=32), nullable=True))
    op.add_column("otp_codes", sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("otp_codes", sa.Column("max_attempts", sa.Integer(), server_default="5", nullable=False))
    op.execute("UPDATE otp_codes SET otp_hash = decode(repeat('00', 32), 'hex'), consumed = true WHERE otp_hash IS NULL")
    op.alter_column("otp_codes", "otp_hash", nullable=False)
    op.drop_column("otp_codes", "otp_code")


def downgrade() -> None:
    op.add_column("otp_codes", sa.Column("otp_code", sa.String(length=16), nullable=True))
    op.drop_column("otp_codes", "max_attempts")
    op.drop_column("otp_codes", "attempt_count")
    op.drop_column("otp_codes", "otp_hash")
