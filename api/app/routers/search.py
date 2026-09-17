from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.chat import Conversation, Message
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
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SearchResponse:
    term = query.strip()
    pattern = f"%{term}%"
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
            posts = session.execute(
                select(Post, User)
                .join(User, User.id == Post.user_id)
                .where(Post.deleted_at.is_(None), _active_user_clause(current_user), Post.content.ilike(pattern))
                .order_by(Post.created_at.desc())
                .limit(limit)
            ).all()
            results.extend(SearchResult(id=post.public_id, type="post", name=author.display_name or author.username, username=author.username, profile_picture_url=author.profile_picture_url, summary=post.content, href=f"/{author.username}/{post.public_id}", created_at=post.created_at) for post, author in posts)
    else:
        participant = or_(Conversation.user_one_id == current_user.id, Conversation.user_two_id == current_user.id)
        other_participant = or_(and_(Conversation.user_one_id == current_user.id, User.id == Conversation.user_two_id), and_(Conversation.user_two_id == current_user.id, User.id == Conversation.user_one_id))
        conversations = session.execute(
            select(Conversation, User)
            .join(User, other_participant)
            .where(participant, Conversation.status.in_(('accepted', 'pending')), _active_user_clause(current_user, public_only=False), or_(User.username.ilike(pattern), User.display_name.ilike(pattern)))
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        ).all()
        results.extend(SearchResult(id=str(conversation.id), type="conversation", name=person.display_name or person.username, username=person.username, profile_picture_url=person.profile_picture_url, summary=f"Chat with {person.display_name or person.username}", href=f"/{person.username}/chat", created_at=conversation.updated_at) for conversation, person in conversations)

        messages = session.execute(
            select(Message, Conversation, User)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(User, other_participant)
            .where(participant, Conversation.status.in_(('accepted', 'pending')), _active_user_clause(current_user, public_only=False), Message.content.ilike(pattern))
            .order_by(Message.created_at.desc())
            .limit(limit)
        ).all()
        results.extend(SearchResult(id=str(message.id), type="conversation", name=person.display_name or person.username, username=person.username, profile_picture_url=person.profile_picture_url, summary=message.content, href=f"/{person.username}/chat", created_at=message.created_at) for message, _, person in messages)

    results.sort(key=lambda item: item.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return SearchResponse(items=results[:limit], has_more=len(results) > limit)
