import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.chat import Conversation, ConversationSetting, ConversationStatus, Message, UserBlock
from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.chat import ChatContextResponse, ChatReadResponse, ChatUserResponse, ConversationListResponse, ConversationResponse, MessagePageResponse, MessageResponse, ReadReceiptPreferenceResponse
from app.services.auth import get_user_by_username
from app.services.notifications import create_notification
from app.services.session_ops import commit, refresh

MAX_PENDING_REQUEST_MESSAGES = 8
MESSAGE_PAGE_SIZE = 50


def can_initiate_chat_request(user: User) -> bool:
    """Subscription boundary; billing will populate subscription_tier later."""
    return getattr(user, "subscription_tier", "free") in {"pro", "pro_plus"}


async def _has_mutual_connection(session: Session, user: User, other: User) -> bool:
    accepted_directions = session.execute(
        select(FollowRequest.requester_id, FollowRequest.recipient_id).where(
            FollowRequest.status == FollowRequestStatus.accepted,
            or_(
                and_(FollowRequest.requester_id == user.id, FollowRequest.recipient_id == other.id),
                and_(FollowRequest.requester_id == other.id, FollowRequest.recipient_id == user.id),
            ),
        )
    ).all()
    directions = {(requester_id, recipient_id) for requester_id, recipient_id in accepted_directions}
    return {(user.id, other.id), (other.id, user.id)} <= directions


def _has_mutual_connection_sync(session: Session, user: User, other: User) -> bool:
    accepted_directions = session.execute(
        select(FollowRequest.requester_id, FollowRequest.recipient_id).where(
            FollowRequest.status == FollowRequestStatus.accepted,
            or_(
                and_(FollowRequest.requester_id == user.id, FollowRequest.recipient_id == other.id),
                and_(FollowRequest.requester_id == other.id, FollowRequest.recipient_id == user.id),
            ),
        )
    ).all()
    directions = {(requester_id, recipient_id) for requester_id, recipient_id in accepted_directions}
    return {(user.id, other.id), (other.id, user.id)} <= directions


def _is_blocked(session: Session, user: User, other: User) -> bool:
    return session.execute(
        select(UserBlock.id).where(
            or_(
                and_(UserBlock.blocker_id == user.id, UserBlock.blocked_id == other.id),
                and_(UserBlock.blocker_id == other.id, UserBlock.blocked_id == user.id),
            )
        )
    ).first() is not None


def _participant(conversation: Conversation, user_id: uuid.UUID) -> User:
    return conversation.user_two if conversation.user_one_id == user_id else conversation.user_one


def _get_setting(session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> ConversationSetting | None:
    return session.execute(
        select(ConversationSetting).where(
            ConversationSetting.conversation_id == conversation_id,
            ConversationSetting.user_id == user_id,
        )
    ).scalar_one_or_none()


def _muted(session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    setting = _get_setting(session, conversation_id, user_id)
    return bool(setting and setting.muted)


def _message_index(conversation: Conversation, message_id: uuid.UUID | None) -> int:
    if message_id is None:
        return -1
    return next((index for index, message in enumerate(conversation.messages) if message.id == message_id), -1)


def _receipt_cursors(session: Session, conversation: Conversation, viewer: User) -> tuple[ConversationSetting | None, ConversationSetting | None]:
    viewer_setting = _get_setting(session, conversation.id, viewer.id)
    peer = _participant(conversation, viewer.id)
    peer_setting = _get_setting(session, conversation.id, peer.id)
    return viewer_setting, peer_setting


def _receipt_visible(session: Session, conversation: Conversation, viewer: User) -> bool:
    if _is_blocked(session, viewer, _participant(conversation, viewer.id)):
        return False
    return bool(getattr(viewer, "read_receipts_enabled", True) and getattr(_participant(conversation, viewer.id), "read_receipts_enabled", True))


def _unread_count(conversation: Conversation, viewer: User, viewer_setting: ConversationSetting | None) -> int:
    read_index = _message_index(conversation, viewer_setting.last_read_message_id if viewer_setting else None)
    return sum(1 for index, message in enumerate(conversation.messages) if index > read_index and message.sender_id != viewer.id)


def _receipt_status(session: Session, conversation: Conversation, message: Message, viewer: User, peer_setting: ConversationSetting | None) -> str:
    if message.sender_id != viewer.id or not peer_setting or _is_blocked(session, viewer, _participant(conversation, viewer.id)):
        return "sent"
    message_index = _message_index(conversation, message.id)
    if _receipt_visible(session, conversation, viewer) and _message_index(conversation, peer_setting.last_read_message_id) >= message_index:
        return "read"
    if _message_index(conversation, peer_setting.last_delivered_message_id) >= message_index:
        return "delivered"
    return "sent"


def _message_response(session: Session, conversation: Conversation, message: Message, viewer: User, peer_setting: ConversationSetting | None = None) -> MessageResponse:
    if peer_setting is None:
        _, peer_setting = _receipt_cursors(session, conversation, viewer)
    return MessageResponse(id=message.id, conversation_id=message.conversation_id, sender_id=message.sender_id, content=message.content, created_at=message.created_at, receipt_status=_receipt_status(session, conversation, message, viewer, peer_setting))


def _receipt_summary(session: Session, conversation: Conversation, viewer: User) -> tuple[int, uuid.UUID | None, uuid.UUID | None, uuid.UUID | None]:
    viewer_setting, peer_setting = _receipt_cursors(session, conversation, viewer)
    unread_count = _unread_count(conversation, viewer, viewer_setting)
    read_index = _message_index(conversation, viewer_setting.last_read_message_id if viewer_setting else None)
    first_unread = next((message.id for index, message in enumerate(conversation.messages) if index > read_index and message.sender_id != viewer.id), None)
    return unread_count, first_unread, peer_setting.last_delivered_message_id if peer_setting else None, peer_setting.last_read_message_id if peer_setting and _receipt_visible(session, conversation, viewer) else None


def _advance_cursor(conversation: Conversation, setting: ConversationSetting, field: str, message_id: uuid.UUID) -> None:
    if _message_index(conversation, message_id) > _message_index(conversation, getattr(setting, field)):
        setattr(setting, field, message_id)


def _composer_state(session: Session, conversation: Conversation | None, user: User, other: User) -> tuple[bool, str, str]:
    if conversation and _is_blocked(session, user, other):
        return False, "Chat unavailable.", "blocked"
    if conversation is None:
        if can_initiate_chat_request(user):
            return True, "Write a message...", "new_request"
        return False, "Chat unavailable.", "unavailable"
    if conversation.status == ConversationStatus.pending:
        if conversation.requester_id == user.id:
            if conversation.requester_message_count >= MAX_PENDING_REQUEST_MESSAGES:
                return False, "Request pending.", "pending_limit"
            return True, "Write a message...", "pending_requester"
        return True, "Reply to accept.", "pending_receiver"
    if not _has_mutual_connection_sync(session, user, other):
        return False, "Chat unavailable.", "connection_lost"
    return True, "Write a message...", "accepted"


def _conversation_response(session: Session, conversation: Conversation, viewer: User) -> ConversationResponse:
    participant = _participant(conversation, viewer.id)
    can_send, placeholder, _ = _composer_state(session, conversation, viewer, participant)
    setting = _get_setting(session, conversation.id, viewer.id)
    latest = conversation.messages[-1] if conversation.messages else None
    unread_count, _, _, _ = _receipt_summary(session, conversation, viewer)
    return ConversationResponse(
        id=conversation.id,
        participant=ChatUserResponse(id=participant.id, username=participant.username, display_name=participant.display_name, profile_picture_url=participant.profile_picture_url),
        preview=latest.content if latest else None,
        updated_at=conversation.updated_at,
        status=conversation.status.value,
        unread=unread_count > 0,
        requester_id=conversation.requester_id,
        muted=bool(setting and setting.muted),
        archived=bool(setting and setting.archived),
        can_send=can_send,
        composer_placeholder=placeholder,
        requester_message_count=conversation.requester_message_count,
        unread_count=unread_count,
    )


async def get_chat_context(session: Session, user: User, username: str) -> ChatContextResponse:
    other = await get_user_by_username(session, username)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if other.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot message yourself.")
    user_one_id, user_two_id = sorted((user.id, other.id), key=str)
    conversation = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.user_one), selectinload(Conversation.user_two), selectinload(Conversation.messages))
        .where(Conversation.user_one_id == user_one_id, Conversation.user_two_id == user_two_id)
    ).scalar_one_or_none()
    if not conversation and await _has_mutual_connection(session, user, other):
        conversation = Conversation(user_one_id=user_one_id, user_two_id=user_two_id, status=ConversationStatus.accepted)
        session.add(conversation)
        await commit(session)
        await refresh(session, conversation)
        conversation.user_one = session.get(User, user_one_id)
        conversation.user_two = session.get(User, user_two_id)
        conversation.messages = []
    if conversation:
        response = _conversation_response(session, conversation, user)
        setting = _get_setting(session, conversation.id, user.id)
        return ChatContextResponse(conversation=response, participant=response.participant, can_send=response.can_send, composer_placeholder=response.composer_placeholder, status=response.status, requester_message_count=response.requester_message_count, unread_count=response.unread_count, last_read_message_id=setting.last_read_message_id if setting else None)
    can_send, placeholder, state = _composer_state(session, None, user, other)
    participant = ChatUserResponse(id=other.id, username=other.username, display_name=other.display_name, profile_picture_url=other.profile_picture_url)
    return ChatContextResponse(conversation=None, participant=participant, can_send=can_send, composer_placeholder=placeholder, status=state)


async def list_conversations(session: Session, user: User) -> ConversationListResponse:
    conversations = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.user_one), selectinload(Conversation.user_two), selectinload(Conversation.messages))
        .where(or_(Conversation.user_one_id == user.id, Conversation.user_two_id == user.id))
        .order_by(Conversation.updated_at.desc())
    ).scalars().all()
    return ConversationListResponse(items=[_conversation_response(session, conversation, user) for conversation in conversations])


async def _get_conversation(session: Session, conversation_id: uuid.UUID, user: User) -> Conversation:
    conversation = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.user_one), selectinload(Conversation.user_two), selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    ).scalar_one_or_none()
    if not conversation or user.id not in {conversation.user_one_id, conversation.user_two_id}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conversation


def _notify_if_unmuted(session: Session, conversation: Conversation, recipient: User, actor: User, notification_type: NotificationType) -> None:
    if not _muted(session, conversation.id, recipient.id):
        create_notification(session, recipient_user_id=recipient.id, actor_user_id=actor.id, notification_type=notification_type, payload={"conversation_id": str(conversation.id), "actor_username": actor.username, "actor_display_name": actor.display_name})


async def _send_in_conversation(session: Session, conversation: Conversation, user: User, content: str, client_message_id: str) -> MessageResponse:
    other = _participant(conversation, user.id)
    if _is_blocked(session, user, other):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
    if conversation.status == ConversationStatus.accepted and not _has_mutual_connection_sync(session, user, other):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
    content = content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message cannot be empty.")
    existing = session.execute(select(Message).where(Message.conversation_id == conversation.id, Message.client_message_id == client_message_id)).scalar_one_or_none()
    if existing:
        return _message_response(session, conversation, existing, user)
    was_pending = conversation.status == ConversationStatus.pending
    was_requester = conversation.requester_id == user.id
    if was_pending and was_requester and conversation.requester_message_count >= MAX_PENDING_REQUEST_MESSAGES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request pending.")
    if was_pending and not was_requester:
        conversation.status = ConversationStatus.accepted
    message = Message(conversation_id=conversation.id, sender_id=user.id, content=content, client_message_id=client_message_id)
    session.add(message)
    if was_pending and was_requester:
        first = conversation.requester_message_count == 0
        conversation.requester_message_count += 1
        _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_request_received if first else NotificationType.chat_message)
    elif was_pending and not was_requester:
        _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_request_accepted)
    else:
        _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_message)
    conversation.updated_at = datetime.now(UTC)
    await commit(session)
    await refresh(session, message)
    return _message_response(session, conversation, message, user)


async def send_message(session: Session, user: User, conversation_id: uuid.UUID, content: str, client_message_id: str) -> MessageResponse:
    return await _send_in_conversation(session, await _get_conversation(session, conversation_id, user), user, content, client_message_id)


async def send_message_to_user(session: Session, user: User, username: str, content: str, client_message_id: str) -> tuple[MessageResponse, Conversation]:
    other = await get_user_by_username(session, username)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if other.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot message yourself.")
    user_one_id, user_two_id = sorted((user.id, other.id), key=str)
    conversation = session.execute(select(Conversation).options(selectinload(Conversation.user_one), selectinload(Conversation.user_two), selectinload(Conversation.messages)).where(Conversation.user_one_id == user_one_id, Conversation.user_two_id == user_two_id)).scalar_one_or_none()
    mutual = await _has_mutual_connection(session, user, other)
    if not conversation:
        if _is_blocked(session, user, other):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
        if not mutual and not can_initiate_chat_request(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A paid plan is required to start a chat request.")
        conversation = Conversation(user_one_id=user_one_id, user_two_id=user_two_id, status=ConversationStatus.accepted if mutual else ConversationStatus.pending, requester_id=None if mutual else user.id)
        session.add(conversation)
        await commit(session)
        await refresh(session, conversation)
        conversation.user_one = session.get(User, user_one_id)
        conversation.user_two = session.get(User, user_two_id)
        conversation.messages = []
    return await _send_in_conversation(session, conversation, user, content, client_message_id), conversation


async def accept_request(session: Session, user: User, conversation_id: uuid.UUID) -> ConversationResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    if conversation.status != ConversationStatus.pending or conversation.requester_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a pending received request can be accepted.")
    other = _participant(conversation, user.id)
    conversation.status = ConversationStatus.accepted
    conversation.updated_at = datetime.now(UTC)
    _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_request_accepted)
    await commit(session)
    return _conversation_response(session, conversation, user)


async def set_conversation_setting(session: Session, user: User, conversation_id: uuid.UUID, *, muted: bool | None = None, archived: bool | None = None) -> ConversationResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    setting = _get_setting(session, conversation.id, user.id)
    if not setting:
        setting = ConversationSetting(conversation_id=conversation.id, user_id=user.id)
        session.add(setting)
    if muted is not None:
        setting.muted = muted or setting.archived
        setting.explicitly_muted = muted
    if archived is not None:
        setting.archived = archived
        if archived:
            setting.muted = True
        elif not setting.explicitly_muted:
            setting.muted = False
    await commit(session)
    return _conversation_response(session, conversation, user)


async def list_messages(session: Session, user: User, conversation_id: uuid.UUID, cursor: str | None = None) -> MessagePageResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    statement = select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc(), Message.id.asc()).limit(MESSAGE_PAGE_SIZE + 1)
    if cursor:
        created_at, message_id = _decode_cursor(cursor)
        statement = statement.where(or_(Message.created_at > created_at, and_(Message.created_at == created_at, Message.id > message_id)))
    messages = session.execute(statement).scalars().all()
    has_more = len(messages) > MESSAGE_PAGE_SIZE
    items = messages[:MESSAGE_PAGE_SIZE]
    viewer_setting, _ = _receipt_cursors(session, conversation, user)
    if not _is_blocked(session, user, _participant(conversation, user.id)):
        incoming = [message for message in items if message.sender_id != user.id]
        if incoming:
            if not viewer_setting:
                viewer_setting = ConversationSetting(conversation_id=conversation.id, user_id=user.id)
                session.add(viewer_setting)
            _advance_cursor(conversation, viewer_setting, "last_delivered_message_id", incoming[-1].id)
            await commit(session)
    unread_count, first_unread, peer_delivered, peer_read = _receipt_summary(session, conversation, user)
    _, peer_setting = _receipt_cursors(session, conversation, user)
    return MessagePageResponse(items=[_message_response(session, conversation, item, user, peer_setting) for item in items], next_cursor=_encode_cursor(items[-1]) if items else cursor, has_more=has_more, unread_count=unread_count, first_unread_message_id=first_unread, peer_delivered_message_id=peer_delivered, peer_read_message_id=peer_read, last_read_message_id=viewer_setting.last_read_message_id if viewer_setting else None)


async def mark_messages_read(session: Session, user: User, conversation_id: uuid.UUID, message_id: uuid.UUID) -> ChatReadResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    message = next((item for item in conversation.messages if item.id == message_id), None)
    if not message or message.sender_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only an incoming message can be marked read.")
    if not _is_blocked(session, user, _participant(conversation, user.id)):
        setting = _get_setting(session, conversation.id, user.id)
        if not setting:
            setting = ConversationSetting(conversation_id=conversation.id, user_id=user.id)
            session.add(setting)
        _advance_cursor(conversation, setting, "last_delivered_message_id", message.id)
        _advance_cursor(conversation, setting, "last_read_message_id", message.id)
        await commit(session)
    setting = _get_setting(session, conversation.id, user.id)
    return ChatReadResponse(conversation_id=conversation.id, last_read_message_id=setting.last_read_message_id if setting else None, unread_count=_unread_count(conversation, user, setting))


async def set_read_receipts_enabled(session: Session, user: User, enabled: bool) -> ReadReceiptPreferenceResponse:
    user.read_receipts_enabled = enabled
    await commit(session)
    return ReadReceiptPreferenceResponse(read_receipts_enabled=user.read_receipts_enabled)


def _encode_cursor(message: Message) -> str:
    return f"{message.created_at.isoformat()}|{message.id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        created_at, message_id = cursor.rsplit("|", 1)
        return datetime.fromisoformat(created_at), uuid.UUID(message_id)
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message cursor.") from exc
