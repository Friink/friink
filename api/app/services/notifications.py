import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.notifications import NotificationPageResponse, NotificationResponse, PushSubscriptionRequest, PushSubscriptionResponse, UnreadCountResponse
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


async def list_push_subscriptions(session: Session, user: User) -> list[PushSubscriptionResponse]:
    subscriptions = session.execute(
        select(PushSubscription)
        .where(PushSubscription.user_id == user.id, PushSubscription.active.is_(True))
        .order_by(PushSubscription.created_at.desc(), PushSubscription.id.desc())
    ).scalars().all()
    return [serialize_push_subscription(subscription) for subscription in subscriptions]


async def upsert_push_subscription(
    session: Session,
    user: User,
    payload: PushSubscriptionRequest,
    user_agent: str | None,
) -> PushSubscriptionResponse:
    endpoint = str(payload.endpoint)
    subscription = session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).scalar_one_or_none()
    now = datetime.now().astimezone()
    if subscription is None:
        subscription = PushSubscription(
            user_id=user.id,
            endpoint=endpoint,
            p256dh_key=payload.keys.p256dh,
            auth_key=payload.keys.auth,
            device_label=payload.device_label,
            user_agent=user_agent,
            active=True,
            revoked_at=None,
            last_seen_at=now,
        )
        session.add(subscription)
    else:
        subscription.user_id = user.id
        subscription.p256dh_key = payload.keys.p256dh
        subscription.auth_key = payload.keys.auth
        subscription.device_label = payload.device_label
        subscription.user_agent = user_agent
        subscription.active = True
        subscription.revoked_at = None
        subscription.last_seen_at = now
    await commit(session)
    return serialize_push_subscription(subscription)


async def revoke_push_subscription(session: Session, user: User, subscription_id: uuid.UUID) -> None:
    subscription = session.execute(
        select(PushSubscription).where(PushSubscription.id == subscription_id, PushSubscription.user_id == user.id)
    ).scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Push subscription not found.")
    subscription.active = False
    subscription.revoked_at = datetime.now().astimezone()
    await commit(session)


def serialize_push_subscription(subscription: PushSubscription) -> PushSubscriptionResponse:
    return PushSubscriptionResponse(
        id=subscription.id,
        endpoint=subscription.endpoint,
        device_label=subscription.device_label,
        active=subscription.active,
        revoked_at=subscription.revoked_at,
        created_at=subscription.created_at,
        updated_at=subscription.updated_at,
        last_seen_at=subscription.last_seen_at,
    )


def serialize_notification(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        recipient_user_id=notification.recipient.public_id,
        actor_user_id=notification.actor.public_id if notification.actor else None,
        type=notification.type,
        payload=notification.payload,
        read=notification.read,
        created_at=notification.created_at,
        actor_show_professional_badge=bool(notification.actor and notification.actor.show_professional_badge),
    )
