from datetime import date as date_type
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session, aliased

from app.config import get_settings
from app.db import get_session
from app.models.chat import Conversation, ConversationMember, ConversationType, Message
from app.models.post import Post
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.search import SearchResponse, SearchResult

router = APIRouter(prefix="/search", tags=["search"])


def _active_user_clause(user: User, *, public_only: bool = True):
    active = and_(User.deleted_at.is_(None), User.lifecycle_status == "active")
    if not public_only:
        return active
    return and_(active, or_(User.is_private.is_(False), User.id == user.id))


@router.get("", response_model=SearchResponse)
async def search(
    query: str = Query(min_length=1, max_length=120),
    scope: str = Query(default="global", pattern="^(global|messages)$"),
    kind: str = Query(default="all", pattern="^(all|person|post)$"),
    limit: int = Query(default=24, ge=1, le=50),
    sort: str = Query(default="relevance", pattern="^(relevance|newest|oldest)$"),
    date: str = Query(default="any", pattern="^(any|day|week|month|custom)$"),
    date_from: date_type | None = Query(default=None),
    date_to: date_type | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SearchResponse:
    term = query.strip()
    pattern = f"%{term}%"
    if date == "custom" and (date_from is None or date_to is None):
        raise HTTPException(status_code=422, detail="Custom date filtering requires both date_from and date_to.")
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be later than date_to.")
    now = datetime.now(timezone.utc)
    if date == "day":
        date_start, date_end = now - timedelta(days=1), None
    elif date == "week":
        date_start, date_end = now - timedelta(days=7), None
    elif date == "month":
        date_start, date_end = now - timedelta(days=30), None
    elif date == "custom":
        date_start = datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
        date_end = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    else:
        date_start, date_end = None, None
    results: list[SearchResult] = []

    if scope == "global":
        include_people = kind in {"all", "person"}
        include_posts = kind in {"all", "post"}
        if include_people:
            people = session.scalars(
                select(User)
                .where(_active_user_clause(current_user), or_(User.username.ilike(pattern), User.display_name.ilike(pattern), User.about.ilike(pattern)))
                .order_by(User.username_key)
                .limit(limit)
            ).all()
            results.extend(SearchResult(id=str(person.public_id), type="person", name=person.display_name or person.username, username=person.username, profile_picture_url=person.profile_picture_url, summary=person.about or f"@{person.username}", href=f"/{person.username}") for person in people)

        if include_posts:
            post_filters = [Post.deleted_at.is_(None), _active_user_clause(current_user), Post.content.ilike(pattern)]
            if date_start is not None:
                post_filters.append(Post.created_at >= date_start)
            if date_end is not None:
                post_filters.append(Post.created_at < date_end)
            posts = session.execute(
                select(Post, User)
                .join(User, User.id == Post.user_id)
                .where(*post_filters)
                .order_by(Post.created_at.desc())
                .limit(limit)
            ).all()
            results.extend(SearchResult(id=post.public_id, type="post", name=author.display_name or author.username, username=author.username, profile_picture_url=author.profile_picture_url, summary=post.content, href=f"/{author.username}/{post.public_id}", created_at=post.created_at) for post, author in posts)
    else:
        participant = exists().where(
            ConversationMember.conversation_id == Conversation.id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
        other_user_id = (
            select(ConversationMember.user_id)
            .where(
                ConversationMember.conversation_id == Conversation.id,
                ConversationMember.user_id != current_user.id,
                ConversationMember.left_at.is_(None),
            )
            .order_by(ConversationMember.joined_at, ConversationMember.user_id)
            .limit(1)
            .scalar_subquery()
        )
        other_participant = User.id == other_user_id
        matching_member = aliased(ConversationMember)
        matching_user = aliased(User)
        matching_other = exists().where(
            matching_member.conversation_id == Conversation.id,
            matching_member.user_id != current_user.id,
            matching_member.left_at.is_(None),
            matching_user.id == matching_member.user_id,
            matching_user.deleted_at.is_(None),
            matching_user.lifecycle_status == "active",
            or_(matching_user.username.ilike(pattern), matching_user.display_name.ilike(pattern)),
        )
        conversation_filters = [participant, matching_other, Conversation.status.in_(('accepted', 'pending')), _active_user_clause(current_user, public_only=False)]
        if not get_settings().group_chat_enabled:
            conversation_filters.append(Conversation.conversation_type == ConversationType.direct)
        if date_start is not None:
            conversation_filters.append(Conversation.updated_at >= date_start)
        if date_end is not None:
            conversation_filters.append(Conversation.updated_at < date_end)
        conversations = session.execute(
            select(Conversation, User)
            .join(User, other_participant)
            .where(*conversation_filters)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        ).all()
        results.extend(SearchResult(id=str(conversation.id), type="conversation", name=person.display_name or person.username, username=person.username, profile_picture_url=person.profile_picture_url, summary=f"Chat with {person.display_name or person.username}", href=f"/chats/{conversation.id}", created_at=conversation.updated_at) for conversation, person in conversations)

        message_filters = [participant, Conversation.status.in_(('accepted', 'pending')), _active_user_clause(current_user, public_only=False), Message.content.ilike(pattern)]
        if not get_settings().group_chat_enabled:
            message_filters.append(Conversation.conversation_type == ConversationType.direct)
        if date_start is not None:
            message_filters.append(Message.created_at >= date_start)
        if date_end is not None:
            message_filters.append(Message.created_at < date_end)
        messages = session.execute(
            select(Message, Conversation, User)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(User, User.id == Message.sender_id)
            .where(*message_filters)
            .order_by(Message.created_at.desc())
            .limit(limit)
        ).all()
        results.extend(SearchResult(id=str(message.id), type="conversation", name=person.display_name or person.username, username=person.username, profile_picture_url=person.profile_picture_url, summary=message.content, href=f"/chats/{conversation.id}", created_at=message.created_at) for message, conversation, person in messages)

    if sort == "oldest":
        results.sort(key=lambda item: item.created_at or datetime.max.replace(tzinfo=timezone.utc))
    elif sort == "relevance":
        normalized_term = term.casefold()
        results.sort(key=lambda item: (0 if item.name.casefold() == normalized_term else 1, 0 if item.username and item.username.casefold() == normalized_term else 1, 0 if normalized_term in item.name.casefold() else 1, -(item.created_at.timestamp() if item.created_at else 0)))
    else:
        results.sort(key=lambda item: item.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return SearchResponse(items=results[:limit], has_more=len(results) > limit)
