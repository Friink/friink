import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.models.post import Post, PostKind
from app.models.user import User
from app.schemas.posts import CreatePostRequest, PostKind as PostKindSchema, PostResponse, QuotedPostResponse
from app.services.session_ops import commit, refresh


def normalize_post_kind(kind: PostKind | None) -> PostKindSchema:
    if kind is None:
        return PostKindSchema.post
    return PostKindSchema(kind.value)

async def create_post(session: Session, user: User, data: CreatePostRequest) -> Post:
    if data.media is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Media uploads are not yet supported.")

    quoted_post: Post | None = None
    if data.quoted_post_id:
        quoted_post = session.get(Post, data.quoted_post_id)
        if not quoted_post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quoted post was not found.")

    parent_post: Post | None = None
    if data.parent_post_id:
        parent_post = session.get(Post, data.parent_post_id)
        if not parent_post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent post was not found.")

    if data.kind == PostKindSchema.reply and not parent_post:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Replies require a parent post.")
    if data.kind != PostKindSchema.reply and parent_post:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only replies may set a parent post.")
    if data.kind == PostKindSchema.quote and not quoted_post:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quotes require a quoted post.")
    if data.kind != PostKindSchema.quote and quoted_post:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only quotes may set a quoted post.")

    post = Post(
        user_id=user.id,
        kind=PostKind(data.kind.value),
        parent_post_id=parent_post.id if parent_post else None,
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
        .where(Post.deleted_at.is_(None), or_(Post.kind.is_(None), Post.kind != PostKind.REPLY))
        .order_by(Post.created_at.desc())
    )
    return list(result.scalars().all())


async def get_post_replies(session: Session, post_id: uuid.UUID) -> list[Post]:
    result = session.execute(
        select(Post)
        .options(selectinload(Post.user), selectinload(Post.quoted_post).selectinload(Post.user))
        .where(Post.deleted_at.is_(None), Post.kind == PostKind.REPLY, Post.parent_post_id == post_id)
        .order_by(Post.created_at.asc())
    )
    return list(result.scalars().all())


async def get_post(session: Session, post_id: uuid.UUID) -> Post | None:
    result = session.execute(
        select(Post)
        .options(selectinload(Post.user), selectinload(Post.quoted_post).selectinload(Post.user))
        .where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


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
        kind=normalize_post_kind(post.kind),
        author_username=post.user.username,
        author_display_name=post.user.display_name,
        content=post.content,
        media_count=post.media_count,
        parent_post_id=post.parent_post_id,
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
        media_count=quoted_post.media_count,
        unavailable=False,
    )
