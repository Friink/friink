import uuid
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime
import json

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import aliased, selectinload, with_expression

from app.models.post import Post, PostKind
from app.models.user import User
from app.schemas.posts import CreatePostRequest, FeedContextResponse, FeedPageResponse, PostKind as PostKindSchema, PostResponse, QuotedPostResponse
from app.services.session_ops import commit, refresh

DEFAULT_FEED_LIMIT = 20
MAX_FEED_LIMIT = 100


def clamp_feed_limit(limit: int) -> int:
    return max(1, min(limit, MAX_FEED_LIMIT))


def encode_post_cursor(post: Post) -> str:
    payload = json.dumps({"created_at": post.created_at.isoformat(), "id": str(post.id)}, separators=(",", ":")).encode("utf-8")
    return urlsafe_b64encode(payload).decode("ascii")


def decode_post_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        padding = "=" * (-len(cursor) % 4)
        payload = json.loads(urlsafe_b64decode(f"{cursor}{padding}").decode("utf-8"))
        created_at = datetime.fromisoformat(payload["created_at"])
        post_id = uuid.UUID(payload["id"])
    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid feed cursor.")

    return created_at, post_id


def build_older_than_filter(created_at: datetime, post_id: uuid.UUID):
    return or_(Post.created_at < created_at, and_(Post.created_at == created_at, Post.id < post_id))


def build_newer_than_filter(created_at: datetime, post_id: uuid.UUID):
    return or_(Post.created_at > created_at, and_(Post.created_at == created_at, Post.id > post_id))


def post_count_expressions():
    reply_post = aliased(Post)
    quote_post = aliased(Post)
    reply_count = (
        select(func.count())
        .select_from(reply_post)
        .where(
            reply_post.deleted_at.is_(None),
            reply_post.kind == PostKind.REPLY,
            reply_post.parent_post_id == Post.id,
        )
        .correlate(Post)
        .scalar_subquery()
    )
    quote_count = (
        select(func.count())
        .select_from(quote_post)
        .where(
            quote_post.deleted_at.is_(None),
            quote_post.kind == PostKind.QUOTE,
            quote_post.quoted_post_id == Post.id,
        )
        .correlate(Post)
        .scalar_subquery()
    )
    return reply_count, quote_count


def post_load_options():
    reply_count, quote_count = post_count_expressions()
    return (
        selectinload(Post.user),
        selectinload(Post.quoted_post).selectinload(Post.user),
        with_expression(Post.reply_count, reply_count),
        with_expression(Post.quote_count, quote_count),
    )


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


def post_feed_base_query():
    return (
        select(Post)
        .options(*post_load_options())
        .where(Post.deleted_at.is_(None), Post.kind != PostKind.REPLY)
    )


async def get_posts_page(session: Session, limit: int = DEFAULT_FEED_LIMIT, cursor: str | None = None) -> FeedPageResponse:
    clamped_limit = clamp_feed_limit(limit)
    query = post_feed_base_query().order_by(Post.created_at.desc(), Post.id.desc())

    if cursor:
        created_at, post_id = decode_post_cursor(cursor)
        query = query.where(build_older_than_filter(created_at, post_id))

    result = session.execute(query.limit(clamped_limit + 1))
    posts = list(result.scalars().all())
    has_more = len(posts) > clamped_limit
    page_items = posts[:clamped_limit]

    return FeedPageResponse(
        items=[serialize_post(post) for post in page_items],
        next_cursor=encode_post_cursor(page_items[-1]) if has_more and page_items else None,
        has_more=has_more,
    )


async def get_newer_posts(session: Session, after_created_at: datetime, after_post_id: uuid.UUID, limit: int = DEFAULT_FEED_LIMIT) -> list[Post]:
    clamped_limit = clamp_feed_limit(limit)
    result = session.execute(
        post_feed_base_query()
        .where(build_newer_than_filter(after_created_at, after_post_id))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(clamped_limit)
    )
    return list(result.scalars().all())


async def get_feed_context(session: Session, anchor_post_id: uuid.UUID, before_limit: int = 10, after_limit: int = 10) -> FeedContextResponse | None:
    anchor_post = await get_post(session, anchor_post_id)
    if not anchor_post or anchor_post.kind == PostKind.REPLY:
        return None

    newer_limit = clamp_feed_limit(before_limit)
    older_limit = clamp_feed_limit(after_limit)

    newer_result = session.execute(
        post_feed_base_query()
        .where(build_newer_than_filter(anchor_post.created_at, anchor_post.id))
        .order_by(Post.created_at.asc(), Post.id.asc())
        .limit(newer_limit)
    )
    older_result = session.execute(
        post_feed_base_query()
        .where(build_older_than_filter(anchor_post.created_at, anchor_post.id))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(older_limit + 1)
    )

    newer_posts = list(newer_result.scalars().all())
    newer_posts.reverse()
    older_posts = list(older_result.scalars().all())
    has_more = len(older_posts) > older_limit
    visible_older_posts = older_posts[:older_limit]
    items = [*newer_posts, anchor_post, *visible_older_posts]

    return FeedContextResponse(
        items=[serialize_post(post) for post in items],
        anchor_post_id=anchor_post.id,
        next_cursor=encode_post_cursor(items[-1]) if has_more and items else None,
        has_more=has_more,
    )


async def get_post_replies(session: Session, post_id: uuid.UUID) -> list[Post]:
    result = session.execute(
        select(Post)
        .options(*post_load_options())
        .where(Post.deleted_at.is_(None), Post.kind == PostKind.REPLY, Post.parent_post_id == post_id)
        .order_by(Post.created_at.asc())
    )
    return list(result.scalars().all())


async def get_post(session: Session, post_id: uuid.UUID) -> Post | None:
    result = session.execute(
        select(Post)
        .options(*post_load_options())
        .where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_post_for_response(session: Session, post_id: uuid.UUID) -> Post:
    result = session.execute(
        select(Post)
        .options(*post_load_options())
        .where(Post.id == post_id)
    )
    post = result.scalar_one()
    return post


def serialize_post(post: Post) -> PostResponse:
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        kind=PostKindSchema(post.kind.value),
        author_username=post.user.username,
        author_display_name=post.user.display_name,
        content=post.content,
        media_count=post.media_count,
        parent_post_id=post.parent_post_id,
        quoted_post_id=post.quoted_post_id,
        reply_count=post.reply_count or 0,
        quote_count=post.quote_count or 0,
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
