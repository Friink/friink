import asyncio
from datetime import UTC, date, datetime, timedelta
import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.config import Settings
from app.db import get_session_factory
from app.models.user import User
from app.services.auth import authenticate_user, register_failed_login
from app.services.login_throttling import enforce_ip_throttle
from app.services.security import hash_password


PASSWORD = "Strong1!pass"


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        JWT_SECRET_KEY="failed-login-policy-test-secret-32-bytes",
        ENVIRONMENT="test",
        FRONTEND_URL="http://localhost:3000",
    )


def _request(host: str = "198.51.100.10") -> Request:
    return Request({"type": "http", "method": "POST", "path": "/auth/login", "headers": [], "client": (host, 12345), "server": ("test", 80), "scheme": "http"})


def _user(**values) -> User:
    defaults = {
        "id": uuid.uuid4(),
        "email": f"policy-{uuid.uuid4().hex}@example.com",
        "username": f"policy_{uuid.uuid4().hex[:20]}",
        "password_hash": hash_password(PASSWORD),
        "date_of_birth": date(1990, 1, 1),
        "is_verified": True,
    }
    defaults.update(values)
    defaults.setdefault("username_key", defaults["username"].casefold())
    return User(**defaults)


def test_attempts_during_cooldown_do_not_advance_state() -> None:
    now = datetime.now(UTC)
    user = _user(failed_login_attempts=4, failed_login_last_at=now, locked_until=now + timedelta(minutes=1))
    with get_session_factory()() as session:
        session.add(user)
        session.commit()
        with pytest.raises(HTTPException) as caught:
            asyncio.run(authenticate_user(session, user.email, "Wrong1!pass"))
        assert caught.value.status_code == 429
        session.refresh(user)
        assert user.failed_login_attempts == 4
        assert user.locked_until is not None and user.locked_until > now


def test_successful_login_clears_counter_and_cooldown() -> None:
    user = _user(failed_login_attempts=9, failed_login_last_at=datetime.now(UTC), locked_until=datetime.now(UTC) - timedelta(seconds=1))
    with get_session_factory()() as session:
        session.add(user)
        session.commit()
        authenticated = asyncio.run(authenticate_user(session, user.email, PASSWORD))
        assert authenticated.id == user.id
        session.refresh(user)
        assert user.failed_login_attempts == 0
        assert user.failed_login_last_at is None
        assert user.locked_until is None


def test_add_account_cooldown_does_not_affect_the_active_account() -> None:
    active = _user()
    added = _user(failed_login_attempts=4, failed_login_last_at=datetime.now(UTC), locked_until=datetime.now(UTC) + timedelta(minutes=1))
    with get_session_factory()() as session:
        session.add_all([active, added])
        session.commit()
        with pytest.raises(HTTPException) as caught:
            asyncio.run(authenticate_user(session, added.email, PASSWORD))
        assert caught.value.status_code == 429
        authenticated = asyncio.run(authenticate_user(session, active.email, PASSWORD))
        assert authenticated.id == active.id


def test_email_and_username_identifiers_share_the_same_failure_state() -> None:
    user = _user()
    with get_session_factory()() as session:
        session.add(user)
        session.commit()
        for identifier in (user.email, user.username.upper()):
            with pytest.raises(HTTPException) as caught:
                asyncio.run(authenticate_user(session, identifier, "Wrong1!pass"))
            assert caught.value.status_code == 401
        session.refresh(user)
        assert user.failed_login_attempts == 2


def test_unknown_identifier_creates_no_account_failure_state() -> None:
    with get_session_factory()() as session:
        with pytest.raises(HTTPException) as caught:
            asyncio.run(authenticate_user(session, "unknown@example.com", "Wrong1!pass"))
        assert caught.value.status_code == 401
        assert session.query(User).filter(User.email == "unknown@example.com").count() == 0


def test_unknown_identifier_and_wrong_password_are_generic_and_indistinguishable() -> None:
    user = _user()
    with get_session_factory()() as session:
        session.add(user)
        session.commit()
        errors = []
        for identifier in (user.email, "unknown@example.com"):
            with pytest.raises(HTTPException) as caught:
                asyncio.run(authenticate_user(session, identifier, "Wrong1!pass"))
            errors.append((caught.value.status_code, caught.value.detail))
        assert errors[0] == errors[1]


def test_ip_throttle_is_secondary_shared_across_accounts_and_not_permanent() -> None:
    settings = _settings()
    with get_session_factory()() as session:
        for _ in range(100):
            enforce_ip_throttle(session, _request(), settings)
        with pytest.raises(HTTPException) as caught:
            enforce_ip_throttle(session, _request(), settings)
        assert caught.value.status_code == 429
        with pytest.raises(HTTPException):
            enforce_ip_throttle(session, _request(), settings)
        enforce_ip_throttle(session, _request("198.51.100.11"), settings)


def test_cooldown_response_uses_server_remaining_seconds() -> None:
    now = datetime.now(UTC)
    user = _user(failed_login_attempts=4, failed_login_last_at=now, locked_until=now + timedelta(minutes=1))
    with get_session_factory()() as session:
        session.add(user)
        session.commit()
        with pytest.raises(HTTPException) as caught:
            asyncio.run(authenticate_user(session, user.email, PASSWORD))
        detail = caught.value.detail
        assert detail["code"] == "LOGIN_COOLDOWN"
        assert 1 <= detail["cooldown_seconds"] <= 60
        assert "retry_at" not in detail


def test_notification_failure_does_not_change_login_result_or_primary_state(monkeypatch) -> None:
    user = _user()
    with get_session_factory()() as session:
        session.add(user)
        session.commit()
        monkeypatch.setattr("app.services.auth.record_security_event_safely", lambda *args, **kwargs: None)
        user.failed_login_attempts = 2
        asyncio.run(register_failed_login(session, user, settings=_settings()))
        session.refresh(user)
        assert user.failed_login_attempts == 3
        assert user.locked_until is None
