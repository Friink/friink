"""add post kind and parent linkage

Revision ID: 20260829_0005
Revises: 20260828_0004
Create Date: 2026-08-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260829_0005"
down_revision: str | None = "20260828_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


post_kind = postgresql.ENUM("post", "quote", "reply", name="post_kind")


def upgrade() -> None:
    post_kind.create(op.get_bind(), checkfirst=True)
    op.add_column("posts", sa.Column("kind", post_kind, nullable=False, server_default="post"))
    op.add_column("posts", sa.Column("parent_post_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_posts_parent_post_id_posts", "posts", "posts", ["parent_post_id"], ["id"])
    op.create_index("ix_posts_parent_post_id", "posts", ["parent_post_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_posts_parent_post_id", table_name="posts")
    op.drop_constraint("fk_posts_parent_post_id_posts", "posts", type_="foreignkey")
    op.drop_column("posts", "parent_post_id")
    op.drop_column("posts", "kind")
    post_kind.drop(op.get_bind(), checkfirst=True)
