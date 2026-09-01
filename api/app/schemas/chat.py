import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    client_message_id: str = Field(min_length=1, max_length=64)


class ChatUserResponse(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None
    profile_picture_url: str | None


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessagePageResponse(BaseModel):
    items: list[MessageResponse]
    next_cursor: str | None
    has_more: bool


class ConversationResponse(BaseModel):
    id: uuid.UUID
    participant: ChatUserResponse
    preview: str | None
    updated_at: datetime
    unread: bool = False


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
