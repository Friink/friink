import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.posts import CreatePostRequest, PostResponse
from app.services.posts import create_post, get_post, get_post_for_response, get_posts, serialize_post

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=list[PostResponse])
async def list_posts(session: Session = Depends(get_session)) -> list[PostResponse]:
    return [serialize_post(post) for post in await get_posts(session)]


@router.get("/{post_id}", response_model=PostResponse)
async def get_post_route(post_id: uuid.UUID, session: Session = Depends(get_session)) -> PostResponse:
    post = await get_post(session, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    return serialize_post(post)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_route(
    payload: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> PostResponse:
    post = await create_post(session, current_user, payload)
    return serialize_post(await get_post_for_response(session, post.id))
