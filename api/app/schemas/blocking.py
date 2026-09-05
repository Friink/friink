from datetime import datetime

from pydantic import BaseModel


class BlockedUserResponse(BaseModel):
    id: str
    username: str
    display_name: str | None
    profile_picture_url: str | None
    blocked_at: datetime


class BlockedUserListResponse(BaseModel):
    items: list[BlockedUserResponse]
    next_cursor: str | None = None


class BlockResponse(BaseModel):
    blocked: bool
    username: str
