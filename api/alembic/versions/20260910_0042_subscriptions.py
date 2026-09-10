"""add admin-only subscription foundation and seed plans"""
from collections.abc import Sequence
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260910_0042"
down_revision: str | None = "20260909_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PLANS = [("friink_free", "Friink Free", "Core Friink participation"), ("friink_pro", "Friink Pro", "Professional and communication features"), ("friink_pro_plus", "Friink Pro+", "Pro plus analytics, boost, and reduced advertising")]
ENTITLEMENTS = {"friink_pro": {"message_requests", "profile_views", "longer_posts", "professional_registration", "professional_directory"}, "friink_pro_plus": {"message_requests", "profile_views", "longer_posts", "professional_registration", "professional_directory", "analytics", "profile_boost", "reduced_ads"}}

def upgrade() -> None:
    op.create_table("plans", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("code", sa.String(64), nullable=False), sa.Column("name", sa.String(120), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("code", name="uq_plans_code"))
    op.create_table("plan_entitlements", sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True), sa.Column("entitlement_key", sa.String(100), primary_key=True), sa.UniqueConstraint("plan_id", "entitlement_key", name="uq_plan_entitlement"))
    op.create_table("subscription_assignments", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id"), nullable=False), sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True), sa.Column("status", sa.String(16), server_default="active", nullable=False), sa.Column("granted_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False), sa.Column("reason", sa.String(500), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True), sa.Column("revoked_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_subscription_assignments_user_id", "subscription_assignments", ["user_id"]); op.create_index("ix_subscription_assignments_user_created", "subscription_assignments", ["user_id", "created_at"]); op.create_index("ix_subscription_assignments_user_active", "subscription_assignments", ["user_id", "status"])
    bind = op.get_bind()
    for code, name, description in PLANS:
        pid = uuid.uuid4(); bind.execute(sa.text("INSERT INTO plans (id, code, name, description, active) VALUES (:id, :code, :name, :description, true)"), {"id": pid, "code": code, "name": name, "description": description})
        for key in ENTITLEMENTS.get(code, set()): bind.execute(sa.text("INSERT INTO plan_entitlements (plan_id, entitlement_key) VALUES (:plan_id, :key)"), {"plan_id": pid, "key": key})

def downgrade() -> None:
    op.drop_index("ix_subscription_assignments_user_active", table_name="subscription_assignments"); op.drop_index("ix_subscription_assignments_user_created", table_name="subscription_assignments"); op.drop_index("ix_subscription_assignments_user_id", table_name="subscription_assignments"); op.drop_table("subscription_assignments"); op.drop_table("plan_entitlements"); op.drop_table("plans")
