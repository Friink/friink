from datetime import UTC, datetime, timedelta
import uuid

from app.models.user import User
from app.services.auth import LOCKOUT_ATTEMPTS, LOCKOUT_DURATION


def apply_failed_attempt(user: User, now: datetime) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= LOCKOUT_ATTEMPTS:
        user.locked_until = now + LOCKOUT_DURATION
        user.failed_login_attempts = 0


def test_lockout_after_five_attempts() -> None:
    now = datetime(2026, 8, 27, tzinfo=UTC)
    user = User(
        id=uuid.uuid4(),
        email="user@example.com",
        username="friink",
        password_hash="hash",
        date_of_birth=datetime(2000, 1, 1).date(),
        failed_login_attempts=0,
    )

    for _ in range(LOCKOUT_ATTEMPTS):
        apply_failed_attempt(user, now)

    assert user.failed_login_attempts == 0
    assert user.locked_until == now + timedelta(hours=3)
