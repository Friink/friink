import uuid
from datetime import datetime

from pydantic import BaseModel
from pydantic import Field, HttpUrl, StringConstraints
from typing import Annotated

from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    recipient_user_id: str
    actor_user_id: str | None
    type: NotificationType
    payload: dict
    read: bool
    created_at: datetime
    actor_show_professional_badge: bool = False


class NotificationPageResponse(BaseModel):
    items: list[NotificationResponse]
    next_cursor: datetime | None = None
    has_more: bool


class UnreadCountResponse(BaseModel):
    count: int


class PushSubscriptionKeys(BaseModel):
    p256dh: Annotated[str, StringConstraints(min_length=1, max_length=255)]
    auth: Annotated[str, StringConstraints(min_length=1, max_length=255)]


class PushSubscriptionRequest(BaseModel):
    endpoint: Annotated[HttpUrl, Field(max_length=2048)]
    keys: PushSubscriptionKeys
    device_label: Annotated[str | None, StringConstraints(max_length=128)] = None


class PushSubscriptionResponse(BaseModel):
    id: uuid.UUID
    endpoint: str
    device_label: str | None
    active: bool
    revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime
