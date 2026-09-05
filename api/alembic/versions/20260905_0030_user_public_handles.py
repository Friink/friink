"""add opaque public user handles"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260905_0030"
down_revision: str | None = "20260905_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("public_id", sa.String(length=64), nullable=True))
    op.execute("UPDATE users SET public_id = md5(id::text || random()::text) WHERE public_id IS NULL")
    op.alter_column("users", "public_id", nullable=False)
    op.create_unique_constraint("uq_users_public_id", "users", ["public_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_public_id", "users", type_="unique")
    op.drop_column("users", "public_id")
