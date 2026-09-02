from datetime import UTC, datetime, timedelta
import uuid

from app.models.user import User
from app.services.auth import LOCKOUT_SCHEDULE


def apply_failed_attempt(user: User, now: datetime) -> None:
    user.failed_login_attempts += 1
    for threshold, duration in reversed(LOCKOUT_SCHEDULE):
        if user.failed_login_attempts >= threshold:
            user.locked_until = now + duration
            break


def test_progressive_lockout_schedule() -> None:
    now = datetime(2026, 8, 27, tzinfo=UTC)
    user = User(
        id=uuid.uuid4(),
        email="user@example.com",
        username="friink",
        password_hash="hash",
        date_of_birth=datetime(2000, 1, 1).date(),
        failed_login_attempts=0,
    )

    for _ in range(3):
        apply_failed_attempt(user, now)
    assert user.locked_until == now + timedelta(minutes=30)

    user.locked_until = None
    apply_failed_attempt(user, now)
    assert user.locked_until == now + timedelta(hours=1)

    user.locked_until = None
    apply_failed_attempt(user, now)
    assert user.locked_until == now + timedelta(hours=24)
