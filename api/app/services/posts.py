import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.post import Post
from app.models.user import User
from app.schemas.posts import CreatePostRequest, PostResponse, QuotedPostResponse


async def create_post(session: AsyncSession, user: User, data: CreatePostRequest) -> Post:
    if data.media is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Media uploads are not yet supported.")

    quoted_post: Post | None = None
    if data.quoted_post_id:
        quoted_post = await session.get(Post, data.quoted_post_id)
        if not quoted_post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quoted post was not found.")

    post = Post(
        user_id=user.id,
        content=data.content,
        quoted_post_id=quoted_post.id if quoted_post else None,
        media_count=0,
    )
    session.add(post)
    await session.commit()
    await session.refresh(post)
    return post


async def get_posts(session: AsyncSession) -> list[Post]:
    result = await session.execute(
        select(Post)
        .options(selectinload(Post.user), selectinload(Post.quoted_post).selectinload(Post.user))
        .where(Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
    )
    return list(result.scalars().all())


async def get_post_for_response(session: AsyncSession, post_id: uuid.UUID) -> Post:
    result = await session.execute(
        select(Post)
        .options(selectinload(Post.user), selectinload(Post.quoted_post).selectinload(Post.user))
        .where(Post.id == post_id)
    )
    post = result.scalar_one()
    return post


def serialize_post(post: Post) -> PostResponse:
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        author_username=post.user.username,
        content=post.content,
        media_count=post.media_count,
        quoted_post_id=post.quoted_post_id,
        quoted_post=serialize_quoted_post(post.quoted_post, post.quoted_post_id),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def serialize_quoted_post(quoted_post: Post | None, quoted_post_id: uuid.UUID | None) -> QuotedPostResponse | None:
    if not quoted_post_id:
        return None
    if not quoted_post or quoted_post.deleted_at is not None:
        return QuotedPostResponse(
            id=quoted_post_id,
            author_username=None,
            content="Original post unavailable.",
            unavailable=True,
        )
    return QuotedPostResponse(
        id=quoted_post.id,
        author_username=quoted_post.user.username,
        content=quoted_post.content,
        unavailable=False,
    )
