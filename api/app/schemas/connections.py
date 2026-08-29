import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.connection import FollowRequestStatus


class SendFollowRequestPayload(BaseModel):
    recipient_id: uuid.UUID | None = None
    recipient_username: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def validate_recipient(self) -> "SendFollowRequestPayload":
        if not self.recipient_id and not self.recipient_username:
            raise ValueError("recipient_id or recipient_username is required.")
        return self


class ConnectionUserResponse(BaseModel):
    id: uuid.UUID
    username: str
    is_private: bool = False


class FollowRequestResponse(BaseModel):
    id: uuid.UUID
    requester: ConnectionUserResponse
    recipient: ConnectionUserResponse
    status: FollowRequestStatus
    created_at: datetime
    responded_at: datetime | None


class ConnectionStatusResponse(BaseModel):
    user: ConnectionUserResponse
    state: str
    request: FollowRequestResponse | None = None


class ConnectionListResponse(BaseModel):
    users: list[ConnectionUserResponse]
    count: int
