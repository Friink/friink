import base64
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.chat import Conversation, Message
from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.user import User
from app.schemas.chat import ChatUserResponse, ConversationListResponse, ConversationResponse, MessagePageResponse, MessageResponse
from app.services.auth import get_user_by_username
from app.services.session_ops import commit, refresh

MESSAGE_PAGE_SIZE = 50


def _pair_ids(left: uuid.UUID, right: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (left, right) if str(left) < str(right) else (right, left)


def _encode_cursor(message: Message) -> str:
    payload = {"created_at": message.created_at.isoformat(), "id": str(message.id)}
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return datetime.fromisoformat(payload["created_at"]), uuid.UUID(payload["id"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message cursor.") from exc


async def _get_conversation(session: Session, conversation_id: uuid.UUID, user: User) -> Conversation:
    conversation = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.user_one), selectinload(Conversation.user_two))
        .where(Conversation.id == conversation_id)
    ).scalar_one_or_none()
    if not conversation or user.id not in {conversation.user_one_id, conversation.user_two_id}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conversation


async def _ensure_connected(session: Session, user: User, other: User) -> None:
    connected = session.execute(
        select(FollowRequest.id).where(
            FollowRequest.status == FollowRequestStatus.accepted,
            or_(
                and_(FollowRequest.requester_id == user.id, FollowRequest.recipient_id == other.id),
                and_(FollowRequest.requester_id == other.id, FollowRequest.recipient_id == user.id),
            ),
        )
    ).scalar_one_or_none()
    if connected is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only message a connection.")


async def get_or_create_conversation(session: Session, user: User, username: str) -> Conversation:
    other = await get_user_by_username(session, username)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if other.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot message yourself.")
    await _ensure_connected(session, user, other)
    user_one_id, user_two_id = _pair_ids(user.id, other.id)
    conversation = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.user_one), selectinload(Conversation.user_two))
        .where(Conversation.user_one_id == user_one_id, Conversation.user_two_id == user_two_id)
    ).scalar_one_or_none()
    if conversation:
        return conversation
    conversation = Conversation(user_one_id=user_one_id, user_two_id=user_two_id)
    session.add(conversation)
    await commit(session)
    await refresh(session, conversation)
    conversation.user_one = session.get(User, user_one_id)
    conversation.user_two = session.get(User, user_two_id)
    return conversation


def _participant(conversation: Conversation, user_id: uuid.UUID) -> User:
    return conversation.user_two if conversation.user_one_id == user_id else conversation.user_one


def serialize_conversation(conversation: Conversation, viewer_id: uuid.UUID, preview: str | None = None) -> ConversationResponse:
    participant = _participant(conversation, viewer_id)
    return ConversationResponse(
        id=conversation.id,
        participant=ChatUserResponse(
            id=participant.id,
            username=participant.username,
            display_name=participant.display_name,
            profile_picture_url=participant.profile_picture_url,
        ),
        preview=preview,
        updated_at=conversation.updated_at,
    )


async def list_conversations(session: Session, user: User) -> ConversationListResponse:
    conversations = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.user_one), selectinload(Conversation.user_two), selectinload(Conversation.messages))
        .where(or_(Conversation.user_one_id == user.id, Conversation.user_two_id == user.id))
        .order_by(Conversation.updated_at.desc())
    ).scalars().all()
    items = []
    for conversation in conversations:
        latest = conversation.messages[-1] if conversation.messages else None
        items.append(serialize_conversation(conversation, user.id, latest.content if latest else None))
    return ConversationListResponse(items=items)


async def list_messages(session: Session, user: User, conversation_id: uuid.UUID, cursor: str | None = None) -> MessagePageResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    statement = select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc(), Message.id.asc()).limit(MESSAGE_PAGE_SIZE + 1)
    if cursor:
        created_at, message_id = _decode_cursor(cursor)
        statement = statement.where(or_(Message.created_at > created_at, and_(Message.created_at == created_at, Message.id > message_id)))
    messages = session.execute(statement).scalars().all()
    has_more = len(messages) > MESSAGE_PAGE_SIZE
    items = messages[:MESSAGE_PAGE_SIZE]
    return MessagePageResponse(
        items=[MessageResponse.model_validate(item) for item in items],
        next_cursor=_encode_cursor(items[-1]) if items else cursor,
        has_more=has_more,
    )


async def send_message(session: Session, user: User, conversation_id: uuid.UUID, content: str, client_message_id: str) -> MessageResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    existing = session.execute(
        select(Message).where(Message.conversation_id == conversation.id, Message.client_message_id == client_message_id)
    ).scalar_one_or_none()
    if existing:
        return MessageResponse.model_validate(existing)
    message = Message(conversation_id=conversation.id, sender_id=user.id, content=content.strip(), client_message_id=client_message_id)
    if not message.content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message cannot be empty.")
    session.add(message)
    conversation.updated_at = datetime.now(UTC)
    await commit(session)
    await refresh(session, message)
    return MessageResponse.model_validate(message)
