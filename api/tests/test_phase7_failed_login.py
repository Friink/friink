import asyncio
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import BackgroundTasks, HTTPException
import pytest
from sqlalchemy import delete, select

from app.config import Settings
from app.db import get_session_factory
from app.models.notification_outbox import NotificationChannel, NotificationOutbox
from app.models.security_event import SecurityEvent, SecurityEventType
from app.models.user import User
from app.services.auth import register_failed_login
from app.services.password_reset import complete_password_reset, start_password_reset
from app.services.security import hash_password


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        JWT_SECRET_KEY="phase7-failed-login-test-secret-32-bytes",
        ENVIRONMENT="test",
        FRONTEND_URL="http://localhost:3000",
        RESEND_API_KEY="",
    )


def _seed_user() -> uuid.UUID:
    user_id = uuid.uuid4()
    with get_session_factory()() as session:
        session.add(
            User(
                id=user_id,
                email=f"phase7-{uuid.uuid4().hex}@example.com",
                username=f"phase7_{uuid.uuid4().hex[:20]}",
                username_key=uuid.uuid4().hex,
                password_hash=hash_password("Strong1!pass"),
                date_of_birth=date(1990, 1, 1),
                is_verified=True,
            )
        )
        session.commit()
    return user_id


def _delete_user(user_id: uuid.UUID) -> None:
    with get_session_factory()() as session:
        session.execute(delete(User).where(User.id == user_id))
        session.commit()


def test_third_failed_login_creates_one_alert_outbox_job() -> None:
    user_id = _seed_user()
    try:
        tasks = BackgroundTasks()
        with get_session_factory()() as session:
            user = session.get(User, user_id)
            user.failed_login_attempts = 2
            asyncio.run(register_failed_login(session, user, background_tasks=tasks, settings=_settings()))

            events = session.execute(
                select(SecurityEvent).where(
                    SecurityEvent.user_id == user_id,
                    SecurityEvent.event_type == SecurityEventType.failed_login,
                )
            ).scalars().all()
            alert_events = [event for event in events if event.payload.get("kind") == "failed_login_notification"]
            assert len(alert_events) == 1
            jobs = session.execute(
                select(NotificationOutbox).where(
                    NotificationOutbox.event_id == alert_events[0].id,
                    NotificationOutbox.channel == NotificationChannel.email,
                )
            ).scalars().all()
            assert len(jobs) == 1
            assert len(tasks.tasks) == 1
    finally:
        _delete_user(user_id)


def test_failed_login_alert_is_suppressed_for_24_hours() -> None:
    user_id = _seed_user()
    try:
        with get_session_factory()() as session:
            user = session.get(User, user_id)
            user.failed_login_attempts = 2
            asyncio.run(register_failed_login(session, user, settings=_settings()))
            user.failed_login_attempts = 2
            asyncio.run(register_failed_login(session, user, settings=_settings()))

            events = session.execute(
                select(SecurityEvent).where(
                    SecurityEvent.user_id == user_id,
                    SecurityEvent.event_type == SecurityEventType.failed_login,
                )
            ).scalars().all()
            assert sum(event.payload.get("kind") == "failed_login_notification" for event in events) == 1
    finally:
        _delete_user(user_id)


def test_suspicious_login_reset_requires_a_different_password() -> None:
    user_id = _seed_user()
    try:
        with get_session_factory()() as session:
            user = session.get(User, user_id)
            ordinary_user, ordinary_token = asyncio.run(start_password_reset(session, user.email))
            assert ordinary_user is not None and ordinary_token is not None
            asyncio.run(complete_password_reset(session, ordinary_token, "Strong1!pass"))

        with get_session_factory()() as session:
            user = session.get(User, user_id)
            _user, suspicious_token = asyncio.run(start_password_reset(session, user.email, purpose="suspicious_login"))
            assert suspicious_token is not None
            with pytest.raises(HTTPException, match="different from your current password"):
                asyncio.run(complete_password_reset(session, suspicious_token, "Strong1!pass"))
    finally:
        _delete_user(user_id)


def test_successful_password_reset_clears_progressive_login_state() -> None:
    user_id = _seed_user()
    try:
        with get_session_factory()() as session:
            user = session.get(User, user_id)
            user.failed_login_attempts = 9
            user.failed_login_last_at = datetime.now(UTC)
            user.locked_until = datetime.now(UTC) + timedelta(minutes=15)
            session.commit()
            _user, raw_token = asyncio.run(start_password_reset(session, user.email))
            assert raw_token is not None
            asyncio.run(complete_password_reset(session, raw_token, "Another1!pass"))
            session.refresh(user)
            assert user.failed_login_attempts == 0
            assert user.failed_login_last_at is None
            assert user.locked_until is None
    finally:
        _delete_user(user_id)
