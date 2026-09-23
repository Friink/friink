import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user, require_allowed_origin
from app.schemas.notifications import NotificationPageResponse, NotificationResponse, PushSubscriptionRequest, PushSubscriptionResponse, UnreadCountResponse
from app.services.notifications import get_unread_count, list_notifications, list_push_subscriptions, mark_all_notifications_read, mark_notification_read, revoke_push_subscription, serialize_notification, upsert_push_subscription

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/push-subscriptions", response_model=list[PushSubscriptionResponse])
async def push_subscriptions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[PushSubscriptionResponse]:
    return await list_push_subscriptions(session, current_user)


@router.post("/push-subscriptions", response_model=PushSubscriptionResponse)
async def save_push_subscription(
    payload: PushSubscriptionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> PushSubscriptionResponse:
    require_allowed_origin(request, settings)
    return await upsert_push_subscription(session, current_user, payload, request.headers.get("user-agent"))


@router.delete("/push-subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_push_subscription(
    subscription_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    require_allowed_origin(request, settings)
    await revoke_push_subscription(session, current_user, subscription_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=NotificationPageResponse)
async def notifications(
    cursor: datetime | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NotificationPageResponse:
    return await list_notifications(session, current_user, limit=limit, cursor=cursor)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UnreadCountResponse:
    return await get_unread_count(session, current_user)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def read_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NotificationResponse:
    return serialize_notification(await mark_notification_read(session, current_user, notification_id))


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def read_all_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    await mark_all_notifications_read(session, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
