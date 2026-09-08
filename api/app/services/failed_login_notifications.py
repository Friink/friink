from datetime import UTC, datetime
import uuid

from sqlalchemy import select

from app.config import Settings
from app.db import get_session_factory
from app.models.notification_outbox import NotificationChannel, NotificationOutbox, OutboxStatus
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.services.email import EmailService
from app.services.password_reset import start_password_reset


async def deliver_failed_login_alert(event_id: uuid.UUID, settings: Settings) -> None:
    factory = get_session_factory()
    with factory() as session:
        event = session.get(SecurityEvent, event_id)
        job = session.execute(
            select(NotificationOutbox).where(
                NotificationOutbox.event_id == event_id,
                NotificationOutbox.channel == NotificationChannel.email,
            )
        ).scalar_one_or_none()
        if not event or not job or job.status == OutboxStatus.delivered:
            return
        job.status = OutboxStatus.processing
        job.attempts += 1
        session.commit()
        user = session.get(User, event.user_id) if event.user_id else None
        if not user or user.lifecycle_status != "active":
            job.status = OutboxStatus.delivered
            job.delivered_at = datetime.now(UTC)
            session.commit()
            return
        try:
            _user, raw_token = await start_password_reset(session, user.email, purpose="suspicious_login")
            reset_url = f"{str(settings.frontend_url).rstrip('/')}/reset-password?token={raw_token}"
            await EmailService(settings).send_failed_login_alert(user.email, reset_url)
            job.status = OutboxStatus.delivered
            job.delivered_at = datetime.now(UTC)
            job.last_error = None
        except Exception as exc:
            job.status = OutboxStatus.failed
            job.last_error = str(exc)[:1000]
            job.available_at = datetime.now(UTC)
        session.commit()
