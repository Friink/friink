"""add database-backed subscription administration permissions"""

from collections.abc import Sequence
import uuid

from alembic import op
import sqlalchemy as sa


revision = "20260916_0048"
down_revision: str | None = "20260911_0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISSIONS = (
    ("subscriptions.manage", "Manage subscription assignments"),
    ("professional_status.manage", "Manage professional status"),
)


def upgrade() -> None:
    bind = op.get_bind()
    for key, display_name in PERMISSIONS:
        bind.execute(
            sa.text(
                "INSERT INTO staff_permissions (id, key, display_name) "
                "VALUES (:id, :key, :display_name) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"id": uuid.uuid4(), "key": key, "display_name": display_name},
        )
    bind.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM staff_roles r CROSS JOIN staff_permissions p "
            "WHERE r.key = 'superadmin' "
            "AND p.key IN ('subscriptions.manage', 'professional_status.manage') "
            "ON CONFLICT (role_id, permission_id) DO NOTHING"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM staff_permissions WHERE key IN "
            "('subscriptions.manage', 'professional_status.manage'))"
        )
    )
    bind.execute(
        sa.text(
            "DELETE FROM staff_permissions WHERE key IN "
            "('subscriptions.manage', 'professional_status.manage')"
        )
    )
