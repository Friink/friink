import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.models.post import Post
from app.models.user import User
from app.schemas.posts import CreatePostRequest, PostResponse, QuotedPostResponse
from app.services.session_ops import commit, refresh

async def create_post(session: Session, user: User, data: CreatePostRequest) -> Post:
    if data.media is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Media uploads are not yet supported.")

    quoted_post: Post | None = None
    if data.quoted_post_id:
        quoted_post = session.get(Post, data.quoted_post_id)
        if not quoted_post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quoted post was not found.")

    post = Post(
        user_id=user.id,
        content=data.content,
        quoted_post_id=quoted_post.id if quoted_post else None,
        media_count=0,
    )
    session.add(post)
    await commit(session)
    await refresh(session, post)
    return post


async def get_posts(session: Session) -> list[Post]:
    result = session.execute(
        select(Post)
        .options(selectinload(Post.user), selectinload(Post.quoted_post).selectinload(Post.user))
        .where(Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
    )
    return list(result.scalars().all())


async def get_post_for_response(session: Session, post_id: uuid.UUID) -> Post:
    result = session.execute(
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
        author_display_name=post.user.display_name,
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
            author_display_name=None,
            content="Original post unavailable.",
            unavailable=True,
        )
    return QuotedPostResponse(
        id=quoted_post.id,
        author_username=quoted_post.user.username,
        author_display_name=quoted_post.user.display_name,
        content=quoted_post.content,
        unavailable=False,
    )
