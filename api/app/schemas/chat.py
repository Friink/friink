import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


CHAT_MESSAGE_MAX_LENGTH = 2048
CHAT_MESSAGE_MAX_MEDIA_FILES = 8


class MessageMediaInput(BaseModel):
    storage_key: str
    url: str | None = None


class ChatMediaUploadUrlRequest(BaseModel):
    count: int = Field(ge=1, le=CHAT_MESSAGE_MAX_MEDIA_FILES)


class ChatMediaUploadUrlItem(BaseModel):
    upload_url: str
    public_url: str | None = None
    object_key: str


class ChatMediaUploadUrlResponse(BaseModel):
    items: list[ChatMediaUploadUrlItem]


class ChatMediaConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1, max_length=512)


class ChatMediaConfirmResponse(BaseModel):
    object_key: str
    public_url: str | None = None


class ChatMediaCleanupRequest(BaseModel):
    storage_keys: list[str] = Field(min_length=1, max_length=CHAT_MESSAGE_MAX_MEDIA_FILES)


class SendMessageRequest(BaseModel):
    content: str = Field(default="", max_length=CHAT_MESSAGE_MAX_LENGTH)
    client_message_id: str = Field(min_length=1, max_length=64)
    media: list[MessageMediaInput] = Field(default_factory=list, max_length=CHAT_MESSAGE_MAX_MEDIA_FILES)

    @field_validator("content")
    @classmethod
    def validate_content(cls, content: str) -> str:
        return content.strip()

    @model_validator(mode="after")
    def validate_message_has_content(self) -> "SendMessageRequest":
        if not self.content and not self.media:
            raise ValueError("Message content or media is required.")
        return self


class ChatUserResponse(BaseModel):
    id: str
    username: str
    display_name: str | None
    profile_picture_url: str | None
    show_professional_badge: bool = False


class MessageMediaResponse(BaseModel):
    url: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    client_message_id: str
    sender_id: str
    content: str
    created_at: datetime
    receipt_status: str = "sent"
    media: list[MessageMediaResponse] = []

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
    conversation_type: str = "direct"
    participant: ChatUserResponse
    participants: list[ChatUserResponse] = []
    preview: str | None
    preview_sender_id: str | None = None
    preview_receipt_status: str | None = None
    updated_at: datetime
    unread: bool = False
    status: str = "accepted"
    requester_id: str | None = None
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


class ChatPeopleResponse(BaseModel):
    items: list[ChatUserResponse]


class ChatEligibilityResponse(BaseModel):
    can_send: bool
    status: str


class CreateGroupConversationRequest(BaseModel):
    member_usernames: list[str] = Field(min_length=2, max_length=99)


class GroupMemberChangeRequest(BaseModel):
    usernames: list[str] = Field(min_length=1, max_length=99)


class GroupMemberRoleRequest(BaseModel):
    role: Literal["admin", "member"]


class GroupConversationResponse(BaseModel):
    id: uuid.UUID
    conversation_type: str
    members: list[ChatUserResponse]


class ChatReadResponse(BaseModel):
    conversation_id: uuid.UUID
    last_read_message_id: uuid.UUID | None = None
    unread_count: int = 0


class ReadReceiptPreferenceResponse(BaseModel):
    read_receipts_enabled: bool
