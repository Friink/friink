from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.blocking import BlockResponse, BlockedUserListResponse
from app.schemas.profile_saves import ProfileSaveStatusResponse, SavedProfilePageResponse
from app.schemas.posts import FeedPageResponse
from app.services.blocking import block_user, list_blocked, unblock_user
from app.services.posts import get_user_posts, get_user_replies
from app.services.reactions import list_liked_posts
from app.services.profile_saves import get_profile_save_status, list_saved_profiles, remove_saved_profile, set_profile_save
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


@router.get("/saved", response_model=SavedProfilePageResponse)
async def saved_profiles(cursor: str | None = None, limit: int = Query(default=20, ge=1, le=50), current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> SavedProfilePageResponse:
    return await list_saved_profiles(session, current_user, cursor, limit)


@router.delete("/saved/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_saved_profile_route(profile_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> Response:
    await remove_saved_profile(session, current_user, profile_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{username}/save", response_model=ProfileSaveStatusResponse)
async def profile_save_status(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ProfileSaveStatusResponse:
    return await get_profile_save_status(session, current_user, username)


@router.post("/{username}/save", response_model=ProfileSaveStatusResponse)
async def save_profile(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ProfileSaveStatusResponse:
    return await set_profile_save(session, current_user, username, True)


@router.delete("/{username}/save", response_model=ProfileSaveStatusResponse)
async def unsave_profile(username: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> ProfileSaveStatusResponse:
    return await set_profile_save(session, current_user, username, False)


@router.get("/{username}/likes", response_model=FeedPageResponse)
async def liked_posts(
    username: str,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await list_liked_posts(session, current_user, username, cursor, limit)


@router.get("/{username}/posts", response_model=FeedPageResponse)
async def user_posts(
    username: str,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await get_user_posts(session, current_user, username, limit=limit, cursor=cursor)


@router.get("/{username}/replies", response_model=FeedPageResponse)
async def user_replies(
    username: str,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await get_user_replies(session, current_user, username, limit=limit, cursor=cursor)
