"""add professional registration workflow and directory preferences"""

from collections.abc import Sequence
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "20260917_0050"
down_revision: str | None = "20260917_0049"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for value in ("professional_registration_submitted", "professional_registration_approved", "professional_registration_rejected", "professional_registration_revoked"):
        op.execute(sa.text(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'"))
    op.add_column("users", sa.Column("show_registered_badge", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("show_in_directory", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.create_table(
        "professional_registrations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("institute", sa.String(length=255), nullable=False),
        sa.Column("credential_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("decision_message", sa.Text(), nullable=True),
        sa.Column("decided_by_user_id", sa.UUID(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_professional_registrations_user_id", "professional_registrations", ["user_id"])
    op.create_index("ix_professional_registrations_user_created", "professional_registrations", ["user_id", "created_at"])
    op.create_index("ix_professional_registrations_status_created", "professional_registrations", ["status", "created_at"])
    op.create_index(
        "uq_professional_registrations_pending_user",
        "professional_registrations",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    bind = op.get_bind()
    bind.execute(sa.text("INSERT INTO staff_permissions (id, key, display_name) VALUES (:id, 'professional_registration.manage', 'Manage professional registrations') ON CONFLICT (key) DO NOTHING"), {"id": uuid.uuid4()})
    bind.execute(sa.text("INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM staff_roles r CROSS JOIN staff_permissions p WHERE r.key = 'superadmin' AND p.key = 'professional_registration.manage' ON CONFLICT (role_id, permission_id) DO NOTHING"))
    bind.execute(sa.text("DELETE FROM plan_entitlements WHERE entitlement_key = 'professional_registration'"))


def downgrade() -> None:
    op.drop_index("uq_professional_registrations_pending_user", table_name="professional_registrations")
    op.drop_index("ix_professional_registrations_status_created", table_name="professional_registrations")
    op.drop_index("ix_professional_registrations_user_created", table_name="professional_registrations")
    op.drop_index("ix_professional_registrations_user_id", table_name="professional_registrations")
    op.drop_table("professional_registrations")
    op.drop_column("users", "show_in_directory")
    op.drop_column("users", "show_registered_badge")
