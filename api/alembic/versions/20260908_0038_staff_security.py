"""add staff roles permissions grants and privileged sessions"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = "20260908_0038"
down_revision = "20260908_0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISSIONS = [("staff.access", "Control Panel access"), ("users.view", "View users"), ("users.lock", "Lock users"), ("users.unlock", "Unlock users"), ("sessions.revoke", "Revoke sessions"), ("roles.manage", "Manage roles"), ("audit.view", "View audit log")]

def upgrade() -> None:
    if op.get_context().dialect.name == "postgresql":
        op.execute("ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'staff_mutation'")
    op.create_table("staff_permissions", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("key", sa.String(100), nullable=False, unique=True), sa.Column("display_name", sa.String(160), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("staff_roles", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("key", sa.String(64), nullable=False), sa.Column("display_name", sa.String(120), nullable=False), sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("key", name="uq_staff_roles_key"), sa.UniqueConstraint("display_name", name="uq_staff_roles_display_name"))
    op.create_table("role_permissions", sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_roles.id", ondelete="CASCADE"), primary_key=True), sa.Column("permission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_permissions.id", ondelete="CASCADE"), primary_key=True))
    op.create_table("user_roles", sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_roles.id", ondelete="CASCADE"), primary_key=True))
    op.create_table("user_permission_grants", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("permission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_permissions.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("user_id", "permission_id", name="uq_user_permission_grant"))
    op.create_table("privileged_staff_sessions", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("last_active_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revoke_reason", sa.String(64), nullable=True))
    bind = op.get_bind()
    for key, name in PERMISSIONS:
        bind.execute(sa.text("INSERT INTO staff_permissions (id, key, display_name) VALUES (:id, :key, :name)"), {"id": uuid.uuid4(), "key": key, "name": name})
    role_id = uuid.uuid4()
    bind.execute(sa.text("INSERT INTO staff_roles (id, key, display_name, is_system) VALUES (:id, 'superadmin', 'Superadmin', true)"), {"id": role_id})
    bind.execute(sa.text("INSERT INTO role_permissions (role_id, permission_id) SELECT :role_id, id FROM staff_permissions"), {"role_id": role_id})
    bind.execute(sa.text("INSERT INTO user_roles (user_id, role_id) SELECT id, :role_id FROM users WHERE is_staff = true AND lower(email) = 'admin@friink.com'"), {"role_id": role_id})

def downgrade() -> None:
    for table in ("privileged_staff_sessions", "user_permission_grants", "user_roles", "role_permissions", "staff_roles", "staff_permissions"):
        op.drop_table(table)
