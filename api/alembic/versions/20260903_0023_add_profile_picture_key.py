"""store profile-picture object keys"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260903_0023"
down_revision: str | None = "20260903_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_picture_key", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_picture_key")
