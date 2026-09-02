"""add public ids to posts

Revision ID: 20260830_0009
Revises: 20260829_0008
"""

import secrets
import string
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260830_0009"
down_revision: str | None = "20260829_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _new_id(existing: set[str]) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(8))
        if value not in existing:
            existing.add(value)
            return value


def upgrade() -> None:
    op.add_column("posts", sa.Column("public_id", sa.String(length=8), nullable=True))
    bind = op.get_bind()
    existing = {row[0] for row in bind.execute(sa.text("SELECT public_id FROM posts WHERE public_id IS NOT NULL"))}
    for row in bind.execute(sa.text("SELECT id FROM posts WHERE public_id IS NULL")):
        bind.execute(sa.text("UPDATE posts SET public_id = :public_id WHERE id = :id"), {"public_id": _new_id(existing), "id": row[0]})
    op.alter_column("posts", "public_id", nullable=False)
    op.create_unique_constraint("uq_posts_public_id", "posts", ["public_id"])
    op.create_index("ix_posts_public_id", "posts", ["public_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_posts_public_id", table_name="posts")
    op.drop_constraint("uq_posts_public_id", "posts", type_="unique")
    op.drop_column("posts", "public_id")
