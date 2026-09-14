"""add profile setup intent preference"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_0046"
down_revision = "20260911_0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("use_intent", sa.String(length=24), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "use_intent")
