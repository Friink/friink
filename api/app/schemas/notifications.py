import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    recipient_user_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    type: NotificationType
    payload: dict
    read: bool
    created_at: datetime


class NotificationPageResponse(BaseModel):
    items: list[NotificationResponse]
    next_cursor: datetime | None = None
    has_more: bool


class UnreadCountResponse(BaseModel):
    count: int
