from datetime import UTC, datetime, timedelta
import uuid

from app.models.user import User
from app.services.login_throttling import account_cooldown_for_attempt, clear_expired_account_failure_state


def test_progressive_lockout_schedule_boundaries() -> None:
    now = datetime(2026, 8, 27, tzinfo=UTC)
    user = User(
        id=uuid.uuid4(),
        email="user@example.com",
        username="friink",
        password_hash="hash",
        date_of_birth=datetime(2000, 1, 1).date(),
        failed_login_attempts=0,
    )

    assert account_cooldown_for_attempt(1) is None
    assert account_cooldown_for_attempt(2) is None
    assert account_cooldown_for_attempt(3) is None
    assert account_cooldown_for_attempt(4) == timedelta(minutes=1)
    assert account_cooldown_for_attempt(5) == timedelta(minutes=1)
    assert account_cooldown_for_attempt(6) == timedelta(minutes=5)
    assert account_cooldown_for_attempt(8) == timedelta(minutes=5)
    assert account_cooldown_for_attempt(9) == timedelta(minutes=15)
    assert account_cooldown_for_attempt(100) == timedelta(minutes=15)


def test_expired_failure_state_clears_after_24_hours() -> None:
    now = datetime(2026, 8, 27, tzinfo=UTC)
    user = User(failed_login_attempts=9, failed_login_last_at=now - timedelta(hours=24), locked_until=now - timedelta(minutes=1))
    clear_expired_account_failure_state(user, now)
    assert user.failed_login_attempts == 0
    assert user.failed_login_last_at is None
    assert user.locked_until is None
