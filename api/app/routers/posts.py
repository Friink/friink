import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.security import decode_token
from app.services.auth import user_id_from_subject
from app.schemas.posts import CreatePostRequest, FeedContextResponse, FeedPageResponse, PostResponse
from app.services.posts import can_view_post, create_post, get_feed_context, get_newer_posts, get_post, get_post_by_public_id, get_post_for_response, get_post_replies, get_posts_page, serialize_post

router = APIRouter(prefix="/posts", tags=["posts"])
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_optional_current_user(
    request: Request,
    token: str | None = Depends(optional_oauth2_scheme),
    session: Session = Depends(get_session),
) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token, "access")
        user_id = user_id_from_subject(str(payload.get("sub", "")))
    except Exception:
        return None
    return session.get(User, user_id)


@router.get("", response_model=FeedPageResponse)
async def list_posts(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User | None = Depends(get_optional_current_user),
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await get_posts_page(session, limit=limit, cursor=cursor, viewer=current_user)


@router.get("/updates", response_model=list[PostResponse])
async def list_post_updates(
    after_created_at: datetime,
    after_id: uuid.UUID,
    limit: int = 20,
    current_user: User | None = Depends(get_optional_current_user),
    session: Session = Depends(get_session),
) -> list[PostResponse]:
    return [serialize_post(post, viewer=current_user, session=session) for post in await get_newer_posts(session, after_created_at=after_created_at, after_post_id=after_id, limit=limit, viewer=current_user)]


@router.get("/context/{post_id}", response_model=FeedContextResponse)
async def get_post_context(
    post_id: uuid.UUID,
    before_limit: int = 10,
    after_limit: int = 10,
    current_user: User | None = Depends(get_optional_current_user),
    session: Session = Depends(get_session),
) -> FeedContextResponse:
    context = await get_feed_context(session, post_id, before_limit=before_limit, after_limit=after_limit, viewer=current_user)
    if not context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return context


@router.get("/public/{public_id}", response_model=PostResponse)
async def get_public_post_route(public_id: str, current_user: User | None = Depends(get_optional_current_user), session: Session = Depends(get_session)) -> PostResponse:
    post = await get_post_by_public_id(session, public_id)
    if not post or not can_view_post(session, current_user, post):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return serialize_post(post, viewer=current_user, session=session)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post_route(post_id: uuid.UUID, current_user: User | None = Depends(get_optional_current_user), session: Session = Depends(get_session)) -> PostResponse:
    post = await get_post(session, post_id)
    if not post or not can_view_post(session, current_user, post):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return serialize_post(post, viewer=current_user, session=session)


@router.get("/{post_id}/replies", response_model=list[PostResponse])
async def list_post_replies(post_id: uuid.UUID, current_user: User | None = Depends(get_optional_current_user), session: Session = Depends(get_session)) -> list[PostResponse]:
    return [serialize_post(post, viewer=current_user, session=session) for post in await get_post_replies(session, post_id, viewer=current_user)]


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_route(
    payload: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PostResponse:
    post = await create_post(session, current_user, payload)
    return serialize_post(await get_post_for_response(session, post.id), viewer=current_user, session=session)
