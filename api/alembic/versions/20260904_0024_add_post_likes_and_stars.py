"""add post likes, stars, and like visibility"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260904_0024"
down_revision: str | None = "20260903_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'like'")
    op.add_column("users", sa.Column("likes_visible", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("posts", sa.Column("like_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("posts", sa.Column("star_count", sa.Integer(), server_default="0", nullable=False))
    op.create_check_constraint("ck_posts_like_count_nonnegative", "posts", sa.column("like_count") >= 0)
    op.create_check_constraint("ck_posts_star_count_nonnegative", "posts", sa.column("star_count") >= 0)
    op.create_table(
        "post_likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_likes_post_user"),
    )
    op.create_index("ix_post_likes_user_created", "post_likes", ["user_id", "created_at"])
    op.create_index("ix_post_likes_post_created", "post_likes", ["post_id", "created_at"])
    op.create_table(
        "post_stars",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_stars_post_user"),
    )
    op.create_index("ix_post_stars_user_created", "post_stars", ["user_id", "created_at"])
    op.create_index("ix_post_stars_post_created", "post_stars", ["post_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_post_stars_post_created", table_name="post_stars")
    op.drop_index("ix_post_stars_user_created", table_name="post_stars")
    op.drop_table("post_stars")
    op.drop_index("ix_post_likes_post_created", table_name="post_likes")
    op.drop_index("ix_post_likes_user_created", table_name="post_likes")
    op.drop_table("post_likes")
    op.drop_constraint("ck_posts_star_count_nonnegative", "posts", type_="check")
    op.drop_constraint("ck_posts_like_count_nonnegative", "posts", type_="check")
    op.drop_column("posts", "star_count")
    op.drop_column("posts", "like_count")
    op.drop_column("users", "likes_visible")
