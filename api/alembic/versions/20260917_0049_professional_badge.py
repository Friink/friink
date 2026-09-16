"""add professional profile badge visibility preference"""

from alembic import op
import sqlalchemy as sa


revision = "20260917_0049"
down_revision = "20260916_0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("show_professional_badge", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("users", "show_professional_badge")
