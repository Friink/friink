"""enforce case-insensitive unique usernames

Revision ID: 20260901_0014
Revises: 20260901_0013
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260901_0014"
down_revision: str | None = "20260901_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT lower(username)
                FROM users
                GROUP BY lower(username)
                HAVING COUNT(*) > 1
            ) THEN
                RAISE EXCEPTION 'Cannot normalize usernames: duplicate usernames differ only by case.';
            END IF;
        END $$;
        """
    )
    op.execute("UPDATE users SET username = lower(username) WHERE username <> lower(username)")
    op.execute("DROP INDEX IF EXISTS ix_users_username")
    op.execute("CREATE UNIQUE INDEX uq_users_username_lower ON users (lower(username))")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_username_lower")
    op.execute("CREATE UNIQUE INDEX ix_users_username ON users (username)")
