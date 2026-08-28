"""create posts

Revision ID: 20260828_0002
Revises: 20260827_0001
Create Date: 2026-08-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260828_0002"
down_revision: str | None = "20260827_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quoted_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("media_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("char_length(content) <= 512", name="ck_posts_content_max_length"),
        sa.CheckConstraint("media_count >= 0 AND media_count <= 16", name="ck_posts_media_count_range"),
    )
    op.create_index("ix_posts_user_id", "posts", ["user_id"], unique=False)
    op.create_index("ix_posts_quoted_post_id", "posts", ["quoted_post_id"], unique=False)

    op.create_table(
        "post_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_post_media_post_id", "post_media", ["post_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_post_media_post_id", table_name="post_media")
    op.drop_table("post_media")
    op.drop_index("ix_posts_quoted_post_id", table_name="posts")
    op.drop_index("ix_posts_user_id", table_name="posts")
    op.drop_table("posts")
