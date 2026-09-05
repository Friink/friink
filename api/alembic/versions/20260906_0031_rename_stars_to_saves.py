"""rename post stars to saves"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260906_0031"
down_revision: str | None = "20260905_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column("posts", "star_count", new_column_name="saved_count")
    op.execute(
        "ALTER TABLE posts RENAME CONSTRAINT ck_posts_star_count_nonnegative "
        "TO ck_posts_saved_count_nonnegative"
    )

    op.rename_table("post_stars", "post_saves")
    op.execute(
        "ALTER TABLE post_saves RENAME CONSTRAINT uq_post_stars_post_user "
        "TO uq_post_saves_post_user"
    )
    op.execute("ALTER INDEX ix_post_stars_user_created RENAME TO ix_post_saves_user_created")
    op.execute("ALTER INDEX ix_post_stars_post_created RENAME TO ix_post_saves_post_created")


def downgrade() -> None:
    op.execute("ALTER INDEX ix_post_saves_post_created RENAME TO ix_post_stars_post_created")
    op.execute("ALTER INDEX ix_post_saves_user_created RENAME TO ix_post_stars_user_created")
    op.execute(
        "ALTER TABLE post_saves RENAME CONSTRAINT uq_post_saves_post_user "
        "TO uq_post_stars_post_user"
    )
    op.rename_table("post_saves", "post_stars")

    op.execute(
        "ALTER TABLE posts RENAME CONSTRAINT ck_posts_saved_count_nonnegative "
        "TO ck_posts_star_count_nonnegative"
    )
    op.alter_column("posts", "saved_count", new_column_name="star_count")
