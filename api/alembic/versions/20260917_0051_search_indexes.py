"""add PostgreSQL search indexes

Revision ID: 20260917_0051
Revises: 20260917_0050
"""

from alembic import op

revision = "20260917_0051"
down_revision = "20260917_0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_search_username ON users USING gin (lower(username) gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_search_display_name ON users USING gin (lower(coalesce(display_name, '')) gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_search_about ON users USING gin (lower(coalesce(about, '')) gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_posts_search_content ON posts USING gin (lower(content) gin_trgm_ops)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_messages_search_content ON messages USING gin (lower(content) gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_messages_search_content")
    op.execute("DROP INDEX IF EXISTS ix_posts_search_content")
    op.execute("DROP INDEX IF EXISTS ix_users_search_about")
    op.execute("DROP INDEX IF EXISTS ix_users_search_display_name")
    op.execute("DROP INDEX IF EXISTS ix_users_search_username")
