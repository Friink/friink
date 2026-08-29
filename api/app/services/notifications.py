import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.notifications import NotificationPageResponse, NotificationResponse, UnreadCountResponse
from app.services.session_ops import commit

DEFAULT_NOTIFICATION_LIMIT = 20
MAX_NOTIFICATION_LIMIT = 100


def create_notification(
    session: Session,
    *,
    recipient_user_id: uuid.UUID,
    notification_type: NotificationType,
    actor_user_id: uuid.UUID | None = None,
    payload: dict | None = None,
) -> Notification:
    notification = Notification(
        recipient_user_id=recipient_user_id,
        actor_user_id=actor_user_id,
        type=notification_type,
        payload=payload or {},
    )
    session.add(notification)
    return notification


async def list_notifications(session: Session, user: User, limit: int = DEFAULT_NOTIFICATION_LIMIT, cursor: datetime | None = None) -> NotificationPageResponse:
    clamped_limit = max(1, min(limit, MAX_NOTIFICATION_LIMIT))
    query = (
        select(Notification)
        .where(Notification.recipient_user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    )
    if cursor:
        query = query.where(Notification.created_at < cursor)
    notifications = list(session.execute(query.limit(clamped_limit + 1)).scalars().all())
    has_more = len(notifications) > clamped_limit
    items = notifications[:clamped_limit]
    return NotificationPageResponse(
        items=[serialize_notification(notification) for notification in items],
        next_cursor=items[-1].created_at if has_more and items else None,
        has_more=has_more,
    )


async def get_unread_count(session: Session, user: User) -> UnreadCountResponse:
    count = session.execute(
        select(func.count()).select_from(Notification).where(Notification.recipient_user_id == user.id, Notification.read.is_(False))
    ).scalar_one()
    return UnreadCountResponse(count=count)


async def mark_notification_read(session: Session, user: User, notification_id: uuid.UUID) -> Notification:
    notification = session.get(Notification, notification_id)
    if not notification or notification.recipient_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notification.read = True
    await commit(session)
    return notification


async def mark_all_notifications_read(session: Session, user: User) -> None:
    session.execute(update(Notification).where(Notification.recipient_user_id == user.id, Notification.read.is_(False)).values(read=True))
    await commit(session)


def serialize_notification(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        recipient_user_id=notification.recipient_user_id,
        actor_user_id=notification.actor_user_id,
        type=notification.type,
        payload=notification.payload,
        read=notification.read,
        created_at=notification.created_at,
    )
