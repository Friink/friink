import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.posts import CreatePostRequest, FeedContextResponse, FeedPageResponse, PostResponse
from app.services.posts import create_post, get_feed_context, get_newer_posts, get_post, get_post_for_response, get_post_replies, get_posts_page, serialize_post

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=FeedPageResponse)
async def list_posts(
    cursor: str | None = None,
    limit: int = 20,
    session: Session = Depends(get_session),
) -> FeedPageResponse:
    return await get_posts_page(session, limit=limit, cursor=cursor)


@router.get("/updates", response_model=list[PostResponse])
async def list_post_updates(
    after_created_at: datetime,
    after_id: uuid.UUID,
    limit: int = 20,
    session: Session = Depends(get_session),
) -> list[PostResponse]:
    return [serialize_post(post) for post in await get_newer_posts(session, after_created_at=after_created_at, after_post_id=after_id, limit=limit)]


@router.get("/context/{post_id}", response_model=FeedContextResponse)
async def get_post_context(
    post_id: uuid.UUID,
    before_limit: int = 10,
    after_limit: int = 10,
    session: Session = Depends(get_session),
) -> FeedContextResponse:
    context = await get_feed_context(session, post_id, before_limit=before_limit, after_limit=after_limit)
    if not context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return context


@router.get("/{post_id}", response_model=PostResponse)
async def get_post_route(post_id: uuid.UUID, session: Session = Depends(get_session)) -> PostResponse:
    post = await get_post(session, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return serialize_post(post)


@router.get("/{post_id}/replies", response_model=list[PostResponse])
async def list_post_replies(post_id: uuid.UUID, session: Session = Depends(get_session)) -> list[PostResponse]:
    return [serialize_post(post) for post in await get_post_replies(session, post_id)]


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_route(
    payload: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PostResponse:
    post = await create_post(session, current_user, payload)
    return serialize_post(await get_post_for_response(session, post.id))
