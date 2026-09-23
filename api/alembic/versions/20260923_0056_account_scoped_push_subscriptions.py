"""scope push subscriptions to remembered accounts"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260923_0056"
down_revision: str | None = "20260923_0055"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_push_subscriptions_endpoint", "push_subscriptions", type_="unique")
    op.create_unique_constraint(
        "uq_push_subscriptions_user_endpoint",
        "push_subscriptions",
        ["user_id", "endpoint"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_push_subscriptions_user_endpoint", "push_subscriptions", type_="unique")
    op.create_unique_constraint("uq_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"])
