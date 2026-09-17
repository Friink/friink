from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SearchResult(BaseModel):
    id: str
    type: Literal["person", "post", "conversation"]
    name: str
    username: str | None = None
    profile_picture_url: str | None = None
    summary: str
    href: str | None = None
    created_at: datetime | None = None


class SearchResponse(BaseModel):
    items: list[SearchResult]
    has_more: bool
