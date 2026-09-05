"""add login risk challenges and explicit account locks"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260905_0026"
down_revision: str | None = "20260905_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("account_locked", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.create_table(
        "login_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["recognized_devices.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_login_challenges_user_id", "login_challenges", ["user_id"])
    op.create_index("ix_login_challenges_device_id", "login_challenges", ["device_id"])
    op.add_column(
        "otp_codes",
        sa.Column(
            "login_challenge_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_otp_codes_login_challenge_id",
        "otp_codes",
        "login_challenges",
        ["login_challenge_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_otp_codes_login_challenge_id", "otp_codes", ["login_challenge_id"])


def downgrade() -> None:
    op.drop_index("ix_otp_codes_login_challenge_id", table_name="otp_codes")
    op.drop_constraint("fk_otp_codes_login_challenge_id", "otp_codes", type_="foreignkey")
    op.drop_column("otp_codes", "login_challenge_id")
    op.drop_index("ix_login_challenges_device_id", table_name="login_challenges")
    op.drop_index("ix_login_challenges_user_id", table_name="login_challenges")
    op.drop_table("login_challenges")
    op.drop_column("users", "account_locked")
