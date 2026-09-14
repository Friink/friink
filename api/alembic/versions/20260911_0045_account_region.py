"""store coarse account-creation region"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_0045"
down_revision = "20260911_0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("account_region", sa.String(length=32), nullable=True))
    op.add_column("signup_reservations", sa.Column("account_region", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("signup_reservations", "account_region")
    op.drop_column("users", "account_region")
