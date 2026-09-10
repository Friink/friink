"""add opaque progressive-auth flow state"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260911_0044"
down_revision = "20260910_0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "progressive_auth_flows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("identifier", sa.String(length=320), nullable=False),
        sa.Column("flow_kind", sa.String(length=16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_progressive_auth_flows_expires_at", "progressive_auth_flows", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_progressive_auth_flows_expires_at", table_name="progressive_auth_flows")
    op.drop_table("progressive_auth_flows")
