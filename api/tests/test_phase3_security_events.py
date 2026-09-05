import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

from api.index import app
from app.db import get_session_factory
from app.models.notification import Notification, NotificationType
from app.models.notification_outbox import NotificationChannel, NotificationOutbox, OutboxStatus
from app.models.security_event import SecurityEvent, SecurityEventType
from app.models.user import User
from app.services.security_events import enqueue_email_hook, process_notification_outbox


def test_fresh_login_is_one_event_and_one_notification_refresh_is_not() -> None:
    suffix = uuid.uuid4().hex
    email = f"phase3-{suffix}@example.com"
    username = f"phase3_{suffix[:20]}"
    password = "Strong-pass9!"
    client = TestClient(app)
    user_id = None
    try:
        signup = client.post(
            "/auth/signup",
            json={"email": email, "username": username, "display_name": "Phase 3", "password": password, "date_of_birth": "1990-01-01"},
        )
        assert signup.status_code == 201, signup.text
        login = client.post("/auth/login", json={"identifier": email, "password": password})
        assert login.status_code == 200, login.text
        refresh = client.post("/auth/refresh")
        assert refresh.status_code == 200, refresh.text

        with get_session_factory()() as session:
            user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()
            events = session.execute(select(SecurityEvent).where(SecurityEvent.user_id == user_id)).scalars().all()
            assert sum(event.event_type is SecurityEventType.fresh_login for event in events) == 1
            assert sum(event.event_type is SecurityEventType.refresh for event in events) == 1
            notifications = session.execute(
                select(func.count()).select_from(Notification).where(
                    Notification.recipient_user_id == user_id,
                    Notification.type == NotificationType.login_security,
                )
            ).scalar_one()
            assert notifications == 1
            delivered = session.execute(
                select(func.count()).select_from(NotificationOutbox).where(
                    NotificationOutbox.channel == NotificationChannel.in_app,
                    NotificationOutbox.status == OutboxStatus.delivered,
                )
            ).scalar_one()
            assert delivered >= 1
            event = next(event for event in events if event.event_type is SecurityEventType.fresh_login)
            enqueue_email_hook(session, event.id)
            session.commit()
            process_notification_outbox(session)
            session.commit()
            email_job = session.execute(
                select(NotificationOutbox).where(NotificationOutbox.event_id == event.id, NotificationOutbox.channel == NotificationChannel.email)
            ).scalar_one()
            assert email_job.status is OutboxStatus.failed
            assert email_job.attempts == 1
            email_job.available_at = datetime.now(UTC)
            assert process_notification_outbox(session, email_sender=lambda event: None) == 1
            session.commit()
            assert email_job.status is OutboxStatus.delivered
            assert email_job.attempts == 2
    finally:
        if user_id:
            with get_session_factory()() as session:
                session.execute(delete(User).where(User.id == user_id))
                session.commit()
