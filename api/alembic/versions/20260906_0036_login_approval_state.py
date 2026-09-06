"""add existing-session approval state to login challenges"""
from alembic import op
import sqlalchemy as sa

revision = "20260906_0036"
down_revision = "20260906_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("login_challenges", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("login_challenges", sa.Column("denied_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("login_challenges", "denied_at")
    op.drop_column("login_challenges", "approved_at")
