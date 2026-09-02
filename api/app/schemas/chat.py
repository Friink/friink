import uuid
from datetime import datetime

from pydantic import BaseModel, Field


CHAT_MESSAGE_MAX_LENGTH = 2048


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=CHAT_MESSAGE_MAX_LENGTH)
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
    receipt_status: str = "sent"

    model_config = {"from_attributes": True}


class MessagePageResponse(BaseModel):
    items: list[MessageResponse]
    next_cursor: str | None
    has_more: bool
    unread_count: int = 0
    first_unread_message_id: uuid.UUID | None = None
    peer_delivered_message_id: uuid.UUID | None = None
    peer_read_message_id: uuid.UUID | None = None
    last_read_message_id: uuid.UUID | None = None


class ConversationResponse(BaseModel):
    id: uuid.UUID
    participant: ChatUserResponse
    preview: str | None
    updated_at: datetime
    unread: bool = False
    status: str = "accepted"
    requester_id: uuid.UUID | None = None
    muted: bool = False
    archived: bool = False
    can_send: bool = True
    composer_placeholder: str = "Write a message..."
    requester_message_count: int = 0
    unread_count: int = 0


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]


class ChatContextResponse(BaseModel):
    conversation: ConversationResponse | None
    participant: ChatUserResponse
    can_send: bool
    composer_placeholder: str
    status: str
    requester_message_count: int = 0
    unread_count: int = 0
    last_read_message_id: uuid.UUID | None = None


class ChatReadResponse(BaseModel):
    conversation_id: uuid.UUID
    last_read_message_id: uuid.UUID | None = None
    unread_count: int = 0


class ReadReceiptPreferenceResponse(BaseModel):
    read_receipts_enabled: bool
