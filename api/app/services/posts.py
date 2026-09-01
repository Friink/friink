import uuid
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import UTC, datetime
import json
import logging
import re

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import aliased, selectinload, with_expression

from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import NotificationType
from app.models.post import Post, PostKind, PostMedia
from app.models.user import User
from app.schemas.posts import CreatePostRequest, FeedContextResponse, FeedPageResponse, PostKind as PostKindSchema, PostResponse, QuotedPostResponse
from app.services.session_ops import commit, refresh, rollback
from app.services.post_slug import generate_post_slug
from app.services.post_ids import generate_public_id
from app.services.notifications import create_notification

DEFAULT_FEED_LIMIT = 20
MAX_FEED_LIMIT = 100
MENTION_PATTERN = re.compile(r"(?<![A-Za-z0-9_@])@([A-Za-z0-9][A-Za-z0-9._-]{0,63})")
logger = logging.getLogger(__name__)


def extract_mentioned_usernames(content: str) -> list[str]:
    """Return unique mentioned usernames, preserving their first-use order."""
    seen: set[str] = set()
    usernames: list[str] = []
    for match in MENTION_PATTERN.finditer(content):
        username = match.group(1)
        key = username.casefold()
        if key not in seen:
            seen.add(key)
            usernames.append(username)
    return usernames


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
    quoted_post: Post | None = None
    if data.quoted_post_id:
        quoted_post = session.get(Post, data.quoted_post_id)
        if not quoted_post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quoted post was not found.")
        quote_author = quoted_post.user or session.get(User, quoted_post.user_id)
        if quote_author and quote_author.is_private:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Private posts cannot be quoted.")

    parent_post: Post | None = None
    if data.parent_post_id:
        parent_post = session.get(Post, data.parent_post_id)
        if not parent_post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent post was not found.")
        if not can_view_post(session, user, parent_post):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot reply to this post.")

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
        public_id=generate_public_id(),
        kind=PostKind(data.kind.value),
        parent_post_id=parent_post.id if parent_post else None,
        content=data.content,
        quoted_post_id=quoted_post.id if quoted_post else None,
        media_count=len(data.media or []),
    )
    if data.media:
        post.media = [PostMedia(storage_key=item.storage_key, url=item.url) for item in data.media]
    session.add(post)
    await commit(session)
    await refresh(session, post)

    mentioned_usernames = extract_mentioned_usernames(data.content)
    if mentioned_usernames:
        try:
            mentioned_users = list(
                session.execute(
                    select(User).where(func.lower(User.username).in_([username.casefold() for username in mentioned_usernames]))
                ).scalars().all()
            )
            mentioned_by_username = {mentioned_user.username.casefold(): mentioned_user for mentioned_user in mentioned_users}
            post_slug = generate_post_slug(post.content)
            for username in mentioned_usernames:
                mentioned_user = mentioned_by_username.get(username.casefold())
                if not mentioned_user or mentioned_user.id == user.id:
                    continue
                create_notification(
                    session,
                    recipient_user_id=mentioned_user.id,
                    actor_user_id=user.id,
                    notification_type=NotificationType.mention,
                    payload={
                        "mentioned_username": mentioned_user.username,
                        "post_author_username": user.username,
                        "post_author_display_name": user.display_name,
                        "post_public_id": post.public_id,
                        "post_slug": post_slug,
                    },
                )
            await commit(session)
        except Exception:
            await rollback(session)
            logger.exception("Could not create mention notifications for post %s", post.id)

    return post


def post_feed_base_query():
    return (
        select(Post)
        .options(*post_load_options())
        .where(Post.deleted_at.is_(None), Post.kind != PostKind.REPLY)
    )


def following_post_filter(viewer: User | None):
    if viewer is None:
        return False
    return exists(
        select(FollowRequest.id).where(
            FollowRequest.requester_id == viewer.id,
            FollowRequest.recipient_id == Post.user_id,
            FollowRequest.status == FollowRequestStatus.accepted,
        )
    )


def apply_feed_filter(query, feed: str, viewer: User | None):
    if feed == "following":
        query = query.where(following_post_filter(viewer))
    return query


async def get_posts_page(session: Session, limit: int = DEFAULT_FEED_LIMIT, cursor: str | None = None, viewer: User | None = None, feed: str = "explore") -> FeedPageResponse:
    clamped_limit = clamp_feed_limit(limit)
    query = apply_feed_filter(post_feed_base_query(), feed, viewer).order_by(Post.created_at.desc(), Post.id.desc())

    if cursor:
        created_at, post_id = decode_post_cursor(cursor)
        query = query.where(build_older_than_filter(created_at, post_id))

    result = session.execute(query.limit(clamped_limit + 1))
    posts = list(result.scalars().all())
    has_more = len(posts) > clamped_limit
    page_items = posts[:clamped_limit]

    return FeedPageResponse(
        items=[serialize_post(post, viewer=viewer, session=session) for post in page_items if can_view_post(session, viewer, post)],
        next_cursor=encode_post_cursor(page_items[-1]) if has_more and page_items else None,
        has_more=has_more,
    )


async def get_newer_posts(session: Session, after_created_at: datetime, after_post_id: uuid.UUID, limit: int = DEFAULT_FEED_LIMIT, viewer: User | None = None, feed: str = "explore") -> list[Post]:
    clamped_limit = clamp_feed_limit(limit)
    result = session.execute(
        apply_feed_filter(post_feed_base_query(), feed, viewer)
        .where(build_newer_than_filter(after_created_at, after_post_id))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(clamped_limit)
    )
    return [post for post in result.scalars().all() if can_view_post(session, viewer, post)]


async def get_feed_context(session: Session, anchor_post_id: uuid.UUID, before_limit: int = 10, after_limit: int = 10, viewer: User | None = None, feed: str = "explore") -> FeedContextResponse | None:
    anchor_post = await get_post(session, anchor_post_id)
    if not anchor_post or anchor_post.kind == PostKind.REPLY or not can_view_post(session, viewer, anchor_post):
        return None
    if feed == "following" and not session.execute(select(following_post_filter(viewer)).where(Post.id == anchor_post.id)).scalar():
        return None

    newer_limit = clamp_feed_limit(before_limit)
    older_limit = clamp_feed_limit(after_limit)

    newer_result = session.execute(
        apply_feed_filter(post_feed_base_query(), feed, viewer)
        .where(build_newer_than_filter(anchor_post.created_at, anchor_post.id))
        .order_by(Post.created_at.asc(), Post.id.asc())
        .limit(newer_limit)
    )
    older_result = session.execute(
        apply_feed_filter(post_feed_base_query(), feed, viewer)
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

    visible_items = [post for post in items if can_view_post(session, viewer, post)]
    return FeedContextResponse(
        items=[serialize_post(post, viewer=viewer, session=session) for post in visible_items],
        anchor_post_id=anchor_post.id,
        next_cursor=encode_post_cursor(items[-1]) if has_more and items else None,
        has_more=has_more,
    )


async def get_post_replies(session: Session, post_id: uuid.UUID, viewer: User | None = None) -> list[Post]:
    parent = await get_post(session, post_id)
    if not parent or not can_view_post(session, viewer, parent):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    result = session.execute(
        select(Post)
        .options(*post_load_options())
        .where(Post.deleted_at.is_(None), Post.kind == PostKind.REPLY, Post.parent_post_id == post_id)
        .order_by(Post.created_at.asc())
    )
    return [post for post in result.scalars().all() if can_view_post(session, viewer, post)]


async def get_post(session: Session, post_id: uuid.UUID) -> Post | None:
    result = session.execute(
        select(Post)
        .options(*post_load_options())
        .where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_post_by_public_id(session: Session, public_id: str) -> Post | None:
    result = session.execute(
        select(Post).options(*post_load_options()).where(Post.public_id == public_id, Post.deleted_at.is_(None))
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


async def delete_post(session: Session, user: User, post_id: uuid.UUID, storage) -> None:
    post = session.get(Post, post_id)
    if not post or post.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    if post.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own posts.")
    media_items = list(session.execute(select(PostMedia).where(PostMedia.post_id == post.id)).scalars().all())
    for media in media_items:
        if media.storage_key:
            storage.delete(media.storage_key, user.id)
    post.deleted_at = datetime.now(UTC)
    await commit(session)


def can_view_post(session: Session, viewer: User | None, post: Post) -> bool:
    author = post.user or session.get(User, post.user_id)
    if not author:
        return False
    if not author.is_private:
        return True
    if viewer and viewer.id == post.user_id:
        return True
    if not viewer:
        return False
    result = session.execute(
        select(FollowRequest.id).where(
            FollowRequest.requester_id == viewer.id,
            FollowRequest.recipient_id == post.user_id,
            FollowRequest.status == FollowRequestStatus.accepted,
        )
    )
    return result.scalar_one_or_none() is not None


def serialize_post(post: Post, viewer: User | None = None, session: Session | None = None) -> PostResponse:
    return PostResponse(
        id=post.id,
        public_id=post.public_id or generate_public_id(),
        slug=generate_post_slug(post.content),
        user_id=post.user_id,
        kind=PostKindSchema(post.kind.value),
        author_username=post.user.username,
        author_display_name=post.user.display_name,
        profile_picture_url=post.user.profile_picture_url,
        content=post.content,
        media_count=post.media_count,
        parent_post_id=post.parent_post_id,
        quoted_post_id=post.quoted_post_id,
        reply_count=post.reply_count or 0,
        quote_count=post.quote_count or 0,
        quoted_post=serialize_quoted_post(post.quoted_post, post.quoted_post_id, viewer=viewer, session=session),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def serialize_quoted_post(quoted_post: Post | None, quoted_post_id: uuid.UUID | None, viewer: User | None = None, session: Session | None = None) -> QuotedPostResponse | None:
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
    if quoted_post.user and quoted_post.user.is_private and (not session or not can_view_post(session, viewer, quoted_post)):
        return QuotedPostResponse(
            id=quoted_post.id,
            public_id=getattr(quoted_post, "public_id", None),
            slug=getattr(quoted_post, "slug", None),
            author_username=None,
            author_display_name=None,
            content="Content not available",
            unavailable=True,
        )
    return QuotedPostResponse(
        id=quoted_post.id,
        public_id=getattr(quoted_post, "public_id", None),
        slug=getattr(quoted_post, "slug", None),
        author_username=quoted_post.user.username,
        author_display_name=quoted_post.user.display_name,
        profile_picture_url=quoted_post.user.profile_picture_url,
        content=quoted_post.content,
        media_count=quoted_post.media_count,
        unavailable=False,
    )
