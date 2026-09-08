import uuid
from datetime import UTC, datetime, timedelta
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.notification_outbox import NotificationChannel, NotificationOutbox, OutboxStatus
from app.models.security_event import SecurityEvent, SecurityEventType


def record_security_event(
    session: Session,
    *,
    event_type: SecurityEventType,
    event_key: str,
    user_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    device_id: uuid.UUID | None = None,
    payload: dict | None = None,
    notify_in_app: bool = False,
) -> SecurityEvent:
    event = SecurityEvent(
        event_key=event_key,
        user_id=user_id,
        session_id=session_id,
        device_id=device_id,
        event_type=event_type,
        payload=payload or {},
    )
    session.add(event)
    # SQLAlchemy assigns the UUID default at flush time; the outbox FK must use
    # the concrete event id in the same transaction.
    if hasattr(session, "flush"):
        session.flush()
    if notify_in_app:
        session.add(NotificationOutbox(event_id=event.id, channel=NotificationChannel.in_app))
    return event


def record_bootstrap_refusal(session: Session, *, reason: str, environment: str) -> SecurityEvent:
    """Record only a categorized, secret-free bootstrap refusal."""
    return record_security_event(
        session,
        event_type=SecurityEventType.bootstrap_refused,
        event_key=f"bootstrap-refused:{uuid.uuid4()}",
        payload={"operation": "reserved_superadmin_bootstrap", "reason": reason, "environment": environment},
    )


def enqueue_email_hook(session: Session, event_id: uuid.UUID) -> NotificationOutbox:
    """Provider-neutral hook for a future email delivery adapter."""
    job = NotificationOutbox(event_id=event_id, channel=NotificationChannel.email)
    session.add(job)
    return job


def process_notification_outbox(
    session: Session,
    *,
    limit: int = 50,
    now: datetime | None = None,
    email_sender: Callable[[SecurityEvent], None] | None = None,
) -> int:
    """Deliver ready jobs; safe for duplicate workers through row locks and event uniqueness."""
    now = now or datetime.now(UTC)
    jobs = list(
        session.execute(
            select(NotificationOutbox)
            .where(
                NotificationOutbox.status.in_([OutboxStatus.pending, OutboxStatus.processing, OutboxStatus.failed]),
                NotificationOutbox.available_at <= now,
            )
            .order_by(NotificationOutbox.created_at, NotificationOutbox.id)
            .with_for_update(skip_locked=True)
            .limit(limit)
        ).scalars().all()
    )
    delivered = 0
    for job in jobs:
        job.status = OutboxStatus.processing
        job.attempts += 1
        job.available_at = now + timedelta(minutes=5)
        try:
            event = session.get(SecurityEvent, job.event_id)
            if not event:
                raise ValueError("Security event no longer exists.")
            if job.channel is NotificationChannel.in_app:
                existing = session.execute(
                    select(Notification).where(Notification.security_event_id == event.id)
                ).scalar_one_or_none()
                if existing is None and event.user_id is not None:
                    session.add(
                        Notification(
                            recipient_user_id=event.user_id,
                            security_event_id=event.id,
                            type=NotificationType.login_security,
                            payload=event.payload,
                        )
                    )
                job.status = OutboxStatus.delivered
                job.delivered_at = now
                job.last_error = None
                delivered += 1
            else:
                if email_sender is None:
                    raise RuntimeError("Email delivery adapter is not configured.")
                email_sender(event)
                job.status = OutboxStatus.delivered
                job.delivered_at = now
                job.last_error = None
                delivered += 1
        except Exception as exc:  # retain the job for retry without affecting authentication
            job.status = OutboxStatus.failed
            job.last_error = str(exc)[:1000]
            job.available_at = now + timedelta(minutes=min(60, 2 ** min(job.attempts, 5)))
    return delivered
