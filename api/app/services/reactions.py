import base64
import binascii
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from app.models.chat import UserBlock
from app.models.notification import NotificationType
from app.models.post import Post, PostKind, PostLike, PostStar
from app.models.user import User
from app.schemas.posts import FeedPageResponse, LikeActorPageResponse, LikeActorResponse, ReactionResponse
from app.services.notifications import create_notification
from app.services.post_slug import generate_post_slug
from app.services.posts import can_view_post, post_load_options, serialize_post
from app.services.profile_media import profile_picture_url_for
from app.services.session_ops import commit
from app.services.auth import get_user_by_username
from app.services.blocking import is_blocked

REACTION_PAGE_SIZE = 20
LIKE_ACTOR_PAGE_SIZE = 24


def _encode_cursor(created_at: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{created_at.isoformat()}|{row_id}".encode()).decode()


def _decode_cursor(value: str) -> tuple[datetime, uuid.UUID]:
    try:
        decoded = base64.urlsafe_b64decode(value.encode()).decode()
        date_value, row_id = decoded.split("|", 1)
        return datetime.fromisoformat(date_value), uuid.UUID(row_id)
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid cursor.") from exc


def _reaction_response(post: Post, viewer: User, session: Session) -> ReactionResponse:
    liked = session.execute(
        select(PostLike.id).where(PostLike.post_id == post.id, PostLike.user_id == viewer.id)
    ).scalar_one_or_none() is not None
    starred = session.execute(
        select(PostStar.id).where(PostStar.post_id == post.id, PostStar.user_id == viewer.id)
    ).scalar_one_or_none() is not None
    return ReactionResponse(
        post_id=post.id,
        like_count=post.like_count or 0,
        star_count=post.star_count or 0,
        liked=liked,
        starred=starred,
    )


def _get_reactable_post(session: Session, viewer: User, post_id: uuid.UUID) -> Post:
    post = session.execute(
        select(Post).where(Post.id == post_id).with_for_update()
    ).scalar_one_or_none()
    if not post or post.deleted_at is not None or not can_view_post(session, viewer, post):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")
    if post.kind != PostKind.POST:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only posts can be liked or starred.")
    return post


async def set_like(session: Session, viewer: User, post_id: uuid.UUID, active: bool) -> ReactionResponse:
    post = _get_reactable_post(session, viewer, post_id)
    existing = session.execute(
        select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == viewer.id)
    ).scalar_one_or_none()

    if active and not existing:
        session.add(PostLike(post_id=post.id, user_id=viewer.id))
        post.like_count = (post.like_count or 0) + 1
        if post.user_id != viewer.id:
            create_notification(
                session,
                recipient_user_id=post.user_id,
                actor_user_id=viewer.id,
                notification_type=NotificationType.like,
                payload={
                    "actor_username": viewer.username,
                    "actor_display_name": viewer.display_name,
                    "post_author_username": post.user.username,
                    "post_author_display_name": post.user.display_name,
                    "post_public_id": post.public_id,
                    "post_slug": generate_post_slug(post.content),
                },
            )
    elif not active and existing:
        session.delete(existing)
        post.like_count = max(0, (post.like_count or 0) - 1)

    await commit(session)
    return _reaction_response(post, viewer, session)


async def set_star(session: Session, viewer: User, post_id: uuid.UUID, active: bool) -> ReactionResponse:
    post = _get_reactable_post(session, viewer, post_id)
    existing = session.execute(
        select(PostStar).where(PostStar.post_id == post.id, PostStar.user_id == viewer.id)
    ).scalar_one_or_none()

    if active and not existing:
        session.add(PostStar(post_id=post.id, user_id=viewer.id))
        post.star_count = (post.star_count or 0) + 1
    elif not active and existing:
        session.delete(existing)
        post.star_count = max(0, (post.star_count or 0) - 1)

    await commit(session)
    return _reaction_response(post, viewer, session)


async def list_like_actors(session: Session, viewer: User, post_id: uuid.UUID, query: str, cursor: str | None, limit: int) -> LikeActorPageResponse:
    post = session.get(Post, post_id)
    if not post or post.deleted_at is not None or not can_view_post(session, viewer, post):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")

    blocked = exists(
        select(UserBlock.id).where(
            or_(
                and_(UserBlock.blocker_id == viewer.id, UserBlock.blocked_id == User.id),
                and_(UserBlock.blocker_id == User.id, UserBlock.blocked_id == viewer.id),
            )
        )
    )
    statement = (
        select(PostLike, User)
        .join(User, User.id == PostLike.user_id)
        .where(
            PostLike.post_id == post.id,
            User.is_private.is_(False),
            User.likes_visible.is_(True),
            ~blocked,
        )
        .order_by(PostLike.created_at.desc(), PostLike.id.desc())
    )
    needle = query.strip()
    if needle:
        statement = statement.where(or_(User.username.ilike(f"%{needle}%"), User.display_name.ilike(f"%{needle}%")))
    if cursor:
        created_at, row_id = _decode_cursor(cursor)
        statement = statement.where(
            or_(PostLike.created_at < created_at, and_(PostLike.created_at == created_at, PostLike.id < row_id))
        )

    page_size = max(1, min(limit, LIKE_ACTOR_PAGE_SIZE))
    rows = list(session.execute(statement.limit(page_size + 1)).all())
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    return LikeActorPageResponse(
        items=[
            LikeActorResponse(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                profile_picture_url=profile_picture_url_for(user),
            )
            for _, user in rows
        ],
        next_cursor=_encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None,
        has_more=has_more,
    )


async def list_liked_posts(session: Session, viewer: User, username: str, cursor: str | None, limit: int) -> FeedPageResponse:
    target = await get_user_by_username(session, username)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.id != viewer.id and is_blocked(session, viewer.id, target.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Likes unavailable.")
    if target.id != viewer.id and not target.likes_visible:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Likes unavailable.")

    page_size = max(1, min(limit, REACTION_PAGE_SIZE))
    statement = (
        select(PostLike, Post)
        .options(*post_load_options())
        .join(Post, Post.id == PostLike.post_id)
        .where(PostLike.user_id == target.id, Post.deleted_at.is_(None), Post.kind == PostKind.POST)
        .order_by(PostLike.created_at.desc(), PostLike.id.desc())
    )
    if cursor:
        created_at, row_id = _decode_cursor(cursor)
        statement = statement.where(
            or_(PostLike.created_at < created_at, and_(PostLike.created_at == created_at, PostLike.id < row_id))
        )

    rows = list(session.execute(statement.limit(page_size + 1)).all())
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    visible_posts = [post for _, post in rows if can_view_post(session, viewer, post)]
    return FeedPageResponse(
        items=[serialize_post(post, viewer=viewer, session=session) for post in visible_posts],
        next_cursor=_encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None,
        has_more=has_more,
    )


async def list_starred_posts(session: Session, viewer: User, cursor: str | None, limit: int) -> FeedPageResponse:
    page_size = max(1, min(limit, REACTION_PAGE_SIZE))
    statement = (
        select(PostStar, Post)
        .options(*post_load_options())
        .join(Post, Post.id == PostStar.post_id)
        .where(PostStar.user_id == viewer.id, Post.deleted_at.is_(None), Post.kind == PostKind.POST)
        .order_by(PostStar.created_at.desc(), PostStar.id.desc())
    )
    if cursor:
        created_at, row_id = _decode_cursor(cursor)
        statement = statement.where(
            or_(PostStar.created_at < created_at, and_(PostStar.created_at == created_at, PostStar.id < row_id))
        )

    rows = list(session.execute(statement.limit(page_size + 1)).all())
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    visible_posts = [post for _, post in rows if can_view_post(session, viewer, post)]
    return FeedPageResponse(
        items=[serialize_post(post, viewer=viewer, session=session) for post in visible_posts],
        next_cursor=_encode_cursor(rows[-1][0].created_at, rows[-1][0].id) if has_more and rows else None,
        has_more=has_more,
    )
