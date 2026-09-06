"""add account lifecycle state and deletion timing"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260906_0033"
down_revision = "20260906_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("lifecycle_status", sa.String(length=24), nullable=False, server_default="active"))
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_deadline", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_request_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("deletion_warning_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("reactivation_cooldown_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("login_challenges", sa.Column("kind", sa.String(length=32), nullable=False, server_default="login"))
    op.create_index("ix_users_lifecycle_status", "users", ["lifecycle_status"])
    op.create_unique_constraint("uq_users_deletion_request_id", "users", ["deletion_request_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_deletion_request_id", "users", type_="unique")
    op.drop_index("ix_users_lifecycle_status", table_name="users")
    op.drop_column("login_challenges", "kind")
    for name in ("deleted_at", "reactivation_cooldown_until", "deletion_warning_sent_at", "deletion_request_id", "deletion_deadline", "deletion_requested_at", "deactivated_at", "lifecycle_status"):
        op.drop_column("users", name)
