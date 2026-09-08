"""add staff lookup indexes"""
from collections.abc import Sequence
from alembic import op

revision = "20260908_0039"
down_revision = "20260908_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_index("ix_privileged_staff_sessions_user_active", "privileged_staff_sessions", ["user_id", "revoked_at"])
    op.create_index("ix_privileged_staff_sessions_user_id", "privileged_staff_sessions", ["user_id"])
    op.create_index("ix_user_permission_grants_user_id", "user_permission_grants", ["user_id"])

def downgrade() -> None:
    op.drop_index("ix_user_permission_grants_user_id", table_name="user_permission_grants")
    op.drop_index("ix_privileged_staff_sessions_user_id", table_name="privileged_staff_sessions")
    op.drop_index("ix_privileged_staff_sessions_user_active", table_name="privileged_staff_sessions")
