import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

POST_CONTENT_MAX_LENGTH = 512
POST_MEDIA_MAX_FILES = 16


class PostKind(str, Enum):
    post = "post"
    quote = "quote"
    reply = "reply"


class PostMediaInput(BaseModel):
    storage_key: str | None = None
    url: str | None = None


class CreatePostRequest(BaseModel):
    content: str = Field(min_length=1, max_length=POST_CONTENT_MAX_LENGTH)
    kind: PostKind = PostKind.post
    quoted_post_id: uuid.UUID | None = None
    parent_post_id: uuid.UUID | None = None
    media: list[PostMediaInput] | None = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, content: str) -> str:
        if len(content) > POST_CONTENT_MAX_LENGTH:
            raise ValueError("Post content must be 512 characters or fewer.")
        return content

    @field_validator("media")
    @classmethod
    def validate_media_count(cls, media: list[PostMediaInput] | None) -> list[PostMediaInput] | None:
        if media and len(media) > POST_MEDIA_MAX_FILES:
            raise ValueError("Posts can include at most 16 media files.")
        return media


class QuotedPostResponse(BaseModel):
    id: uuid.UUID | None
    author_username: str | None
    author_display_name: str | None = None
    content: str
    media_count: int = 0
    unavailable: bool = False


class PostResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    kind: PostKind
    author_username: str
    author_display_name: str | None = None
    content: str
    media_count: int
    parent_post_id: uuid.UUID | None
    quoted_post_id: uuid.UUID | None
    reply_count: int = 0
    quote_count: int = 0
    quoted_post: QuotedPostResponse | None
    created_at: datetime
    updated_at: datetime


class FeedPageResponse(BaseModel):
    items: list[PostResponse]
    next_cursor: str | None = None
    has_more: bool


class FeedContextResponse(BaseModel):
    items: list[PostResponse]
    anchor_post_id: uuid.UUID
    next_cursor: str | None = None
    has_more: bool
