import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

POST_CONTENT_MAX_LENGTH = 512
POST_MEDIA_MAX_FILES = 8


class PostKind(str, Enum):
    post = "post"
    quote = "quote"
    reply = "reply"


class PostMediaInput(BaseModel):
    storage_key: str
    url: str | None = None


class PostMediaUploadUrlRequest(BaseModel):
    count: int = Field(ge=1, le=POST_MEDIA_MAX_FILES)


class PostMediaUploadUrlItem(BaseModel):
    upload_url: str
    public_url: str | None = None
    object_key: str


class PostMediaUploadUrlResponse(BaseModel):
    items: list[PostMediaUploadUrlItem]


class PostMediaConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1, max_length=512)


class PostMediaConfirmResponse(BaseModel):
    object_key: str
    public_url: str | None = None


class PostMediaCleanupRequest(BaseModel):
    storage_keys: list[str] = Field(min_length=1, max_length=POST_MEDIA_MAX_FILES)


class CreatePostRequest(BaseModel):
    content: str = Field(max_length=POST_CONTENT_MAX_LENGTH)
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
            raise ValueError("Posts can include at most 8 media files.")
        return media

    @model_validator(mode="after")
    def validate_content_required_for_kind(self) -> "CreatePostRequest":
        if self.kind != PostKind.quote and not self.content.strip() and not self.media:
            raise ValueError("Post content is required.")
        return self


class QuotedPostResponse(BaseModel):
    id: uuid.UUID | None
    public_id: str | None = None
    slug: str | None = None
    author_username: str | None
    author_display_name: str | None = None
    profile_picture_url: str | None = None
    content: str
    media_count: int = 0
    media: list["PostMediaResponse"] = []
    unavailable: bool = False


class PostMediaResponse(BaseModel):
    url: str


class PostResponse(BaseModel):
    id: uuid.UUID
    public_id: str
    slug: str
    user_id: uuid.UUID
    kind: PostKind
    author_username: str
    author_display_name: str | None = None
    profile_picture_url: str | None = None
    content: str
    media_count: int
    media: list[PostMediaResponse] = []
    parent_post_id: uuid.UUID | None
    quoted_post_id: uuid.UUID | None
    reply_count: int = 0
    quote_count: int = 0
    like_count: int = 0
    star_count: int = 0
    liked: bool | None = None
    starred: bool | None = None
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


class ReactionResponse(BaseModel):
    post_id: uuid.UUID
    like_count: int
    star_count: int
    liked: bool
    starred: bool


class LikeActorResponse(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None = None
    profile_picture_url: str | None = None


class LikeActorPageResponse(BaseModel):
    items: list[LikeActorResponse]
    next_cursor: str | None = None
    has_more: bool
