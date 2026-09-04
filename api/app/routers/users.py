from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.blocking import BlockResponse, BlockedUserListResponse
from app.schemas.posts import FeedPageResponse
from app.services.blocking import block_user, list_blocked, unblock_user
from app.services.reactions import list_liked_posts
from app.services.session_ops import commit

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/{username}/block", response_model=BlockResponse)
async def create_block(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> BlockResponse:
    await block_user(session, current_user, username)
    return BlockResponse(blocked=True, username=username.lower())

@router.delete("/{username}/block", response_model=BlockResponse)
async def remove_block(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> BlockResponse:
    await unblock_user(session, current_user, username)
    return BlockResponse(blocked=False, username=username.lower())

@router.get("/blocked", response_model=BlockedUserListResponse)
async def blocked_users(query: str = Query(default="", max_length=120), cursor: str | None = Query(default=None), limit: int = Query(default=24, ge=1, le=50), current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> BlockedUserListResponse:
    return await list_blocked(session, current_user, query, cursor, limit)


@router.get("/{username}/likes", response_model=FeedPageResponse)
async def liked_posts(
    username: str,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await list_liked_posts(session, current_user, username, cursor, limit)
