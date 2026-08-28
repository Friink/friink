import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

POST_CONTENT_MAX_LENGTH = 512
POST_MEDIA_MAX_FILES = 16


class PostMediaInput(BaseModel):
    storage_key: str | None = None
    url: str | None = None


class CreatePostRequest(BaseModel):
    content: str = Field(min_length=1, max_length=POST_CONTENT_MAX_LENGTH)
    quoted_post_id: uuid.UUID | None = None
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
    content: str
    unavailable: bool = False


class PostResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    author_username: str
    content: str
    media_count: int
    quoted_post_id: uuid.UUID | None
    quoted_post: QuotedPostResponse | None
    created_at: datetime
    updated_at: datetime
