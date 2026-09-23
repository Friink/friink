import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, not_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models.chat import Conversation, ConversationMember, ConversationSetting, ConversationStatus, ConversationType, Message, MessageMedia, UserBlock
from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.chat import ChatContextResponse, ChatEligibilityResponse, ChatPeopleResponse, ChatReadResponse, ChatUserResponse, ConversationListResponse, ConversationResponse, GroupConversationResponse, MessagePageResponse, MessageResponse, ReadReceiptPreferenceResponse
from app.services.auth import get_user_by_username
from app.services.notifications import create_notification
from app.services.profile_media import profile_picture_url_for
from app.services.subscriptions import has_entitlement
from app.services.session_ops import commit, refresh

MAX_PENDING_REQUEST_MESSAGES = 8
MESSAGE_PAGE_SIZE = 50


async def search_chat_people(session: Session, user: User, query: str) -> ChatPeopleResponse:
    term = query.strip()
    if len(term) < 2:
        return ChatPeopleResponse(items=[])
    pattern = f"%{term}%"
    accepted_private_visibility = exists().where(
        FollowRequest.requester_id == user.id,
        FollowRequest.recipient_id == User.id,
        FollowRequest.status == FollowRequestStatus.accepted,
    )
    blocked = exists().where(
        or_(
            and_(UserBlock.blocker_id == user.id, UserBlock.blocked_id == User.id),
            and_(UserBlock.blocker_id == User.id, UserBlock.blocked_id == user.id),
        )
    )
    people = session.scalars(
        select(User)
        .where(
            User.id != user.id,
            User.deleted_at.is_(None),
            User.lifecycle_status == "active",
            or_(User.is_private.is_(False), accepted_private_visibility),
            not_(blocked),
            or_(User.username.ilike(pattern), User.display_name.ilike(pattern)),
        )
        .order_by(User.username_key)
        .limit(20)
    ).all()
    return ChatPeopleResponse(items=[
        ChatUserResponse(
            id=person.public_id,
            username=person.username,
            display_name=person.display_name,
            profile_picture_url=profile_picture_url_for(person),
            show_professional_badge=person.show_professional_badge,
        )
        for person in people
    ])


async def get_chat_eligibility(session: Session, user: User, username: str) -> ChatEligibilityResponse:
    other = await get_user_by_username(session, username)
    if not other or other.id == user.id or other.deleted_at is not None or other.lifecycle_status != "active":
        return ChatEligibilityResponse(can_send=False, status="unavailable")
    if _is_blocked(session, user, other):
        return ChatEligibilityResponse(can_send=False, status="unavailable")
    if other.is_private and not session.execute(
        select(FollowRequest.id).where(
            FollowRequest.requester_id == user.id,
            FollowRequest.recipient_id == other.id,
            FollowRequest.status == FollowRequestStatus.accepted,
        )
    ).first():
        return ChatEligibilityResponse(can_send=False, status="unavailable")

    user_one_id, user_two_id = sorted((user.id, other.id), key=str)
    conversation = _find_direct_conversation(session, user_one_id, user_two_id)
    if conversation:
        can_send, _, state = _composer_state(session, conversation, user, other)
        return ChatEligibilityResponse(can_send=can_send, status=state)
    if await _has_mutual_connection(session, user, other):
        return ChatEligibilityResponse(can_send=True, status="accepted")
    can_send, _, state = _composer_state(session, None, user, other)
    return ChatEligibilityResponse(can_send=can_send, status=state)


def can_initiate_chat_request(session: Session, user: User) -> bool:
    """Only the server-resolved message-request entitlement grants access."""
    return has_entitlement(user, "message_requests", session)


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


def _active_members(session: Session, conversation_id: uuid.UUID) -> list[User]:
    return session.scalars(
        select(User)
        .join(ConversationMember, ConversationMember.user_id == User.id)
        .where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.left_at.is_(None),
        )
        .order_by(ConversationMember.joined_at, ConversationMember.user_id)
    ).all()


def _membership(session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> ConversationMember | None:
    return session.get(ConversationMember, (conversation_id, user_id))


def _find_direct_conversation(session: Session, first_user_id: uuid.UUID, second_user_id: uuid.UUID, *, load_messages: bool = False) -> Conversation | None:
    statement = select(Conversation).where(
        Conversation.conversation_type == ConversationType.direct,
        exists().where(
            ConversationMember.conversation_id == Conversation.id,
            ConversationMember.user_id == first_user_id,
            ConversationMember.left_at.is_(None),
        ),
        exists().where(
            ConversationMember.conversation_id == Conversation.id,
            ConversationMember.user_id == second_user_id,
            ConversationMember.left_at.is_(None),
        ),
    )
    if load_messages:
        statement = statement.options(selectinload(Conversation.messages).selectinload(Message.media))
    return session.execute(statement).scalar_one_or_none()


def _participant(session: Session, conversation: Conversation, user_id: uuid.UUID) -> User:
    members = _active_members(session, conversation.id)
    participant = next((member for member in members if member.id != user_id), None)
    if participant is None:
        participant = next((member for member in members if member.id == user_id), None)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return participant


def _conversation_other_members(session: Session, conversation: Conversation, user_id: uuid.UUID) -> list[User]:
    return [member for member in _active_members(session, conversation.id) if member.id != user_id]


def _is_group_blocked(session: Session, conversation: Conversation, user: User) -> bool:
    return any(_is_blocked(session, user, member) for member in _conversation_other_members(session, conversation, user.id))


def _conversation_is_blocked(session: Session, conversation: Conversation, user: User) -> bool:
    if conversation.conversation_type == ConversationType.group:
        return _is_group_blocked(session, conversation, user)
    return _is_blocked(session, user, _participant(session, conversation, user.id))


def _require_group_chat_enabled() -> None:
    if not get_settings().group_chat_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Group chats are not available.")


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
    peer = _participant(session, conversation, viewer.id)
    peer_setting = _get_setting(session, conversation.id, peer.id)
    return viewer_setting, peer_setting


def _recipient_settings(session: Session, conversation: Conversation, viewer: User) -> list[tuple[User, ConversationSetting | None]]:
    return [(member, _get_setting(session, conversation.id, member.id)) for member in _conversation_other_members(session, conversation, viewer.id)]


def _receipt_visible(session: Session, conversation: Conversation, viewer: User) -> bool:
    if conversation.conversation_type == ConversationType.group:
        recipients = _conversation_other_members(session, conversation, viewer.id)
        return bool(recipients) and all(
            not _is_blocked(session, viewer, recipient)
            and getattr(viewer, "read_receipts_enabled", True)
            and getattr(recipient, "read_receipts_enabled", True)
            for recipient in recipients
        )
    peer = _participant(session, conversation, viewer.id)
    if _is_blocked(session, viewer, peer):
        return False
    return bool(getattr(viewer, "read_receipts_enabled", True) and getattr(peer, "read_receipts_enabled", True))


def _unread_count(conversation: Conversation, viewer: User, viewer_setting: ConversationSetting | None) -> int:
    read_index = _message_index(conversation, viewer_setting.last_read_message_id if viewer_setting else None)
    return sum(1 for index, message in enumerate(conversation.messages) if index > read_index and message.sender_id != viewer.id)


def _receipt_status(session: Session, conversation: Conversation, message: Message, viewer: User, peer_setting: ConversationSetting | None = None) -> str:
    if message.sender_id != viewer.id:
        return "sent"
    message_index = _message_index(conversation, message.id)
    recipients = _recipient_settings(session, conversation, viewer)
    if not recipients:
        return "sent"
    if _receipt_visible(session, conversation, viewer) and all(
        setting is not None and _message_index(conversation, setting.last_read_message_id) >= message_index
        for _, setting in recipients
    ):
        return "read"
    if all(setting is not None and _message_index(conversation, setting.last_delivered_message_id) >= message_index for _, setting in recipients):
        return "delivered"
    return "sent"


def _message_response(session: Session, conversation: Conversation, message: Message, viewer: User, peer_setting: ConversationSetting | None = None) -> MessageResponse:
    if peer_setting is None:
        _, peer_setting = _receipt_cursors(session, conversation, viewer)
    sender = session.get(User, message.sender_id)
    return MessageResponse(id=message.id, conversation_id=message.conversation_id, sender_id=sender.public_id, content=message.content, created_at=message.created_at, receipt_status=_receipt_status(session, conversation, message, viewer, peer_setting), media=[{"url": item.url} for item in message.media if item.url])


def _receipt_summary(session: Session, conversation: Conversation, viewer: User) -> tuple[int, uuid.UUID | None, uuid.UUID | None, uuid.UUID | None]:
    viewer_setting, peer_setting = _receipt_cursors(session, conversation, viewer)
    unread_count = _unread_count(conversation, viewer, viewer_setting)
    read_index = _message_index(conversation, viewer_setting.last_read_message_id if viewer_setting else None)
    first_unread = next((message.id for index, message in enumerate(conversation.messages) if index > read_index and message.sender_id != viewer.id), None)
    if conversation.conversation_type == ConversationType.group:
        recipients = [setting for _, setting in _recipient_settings(session, conversation, viewer)]
        def common_cursor(field: str) -> uuid.UUID | None:
            if not recipients or any(setting is None or getattr(setting, field) is None for setting in recipients):
                return None
            message_index = min(_message_index(conversation, getattr(setting, field)) for setting in recipients if setting)
            return conversation.messages[message_index].id if message_index >= 0 else None
        peer_delivered = common_cursor("last_delivered_message_id")
        peer_read = common_cursor("last_read_message_id") if _receipt_visible(session, conversation, viewer) else None
        return unread_count, first_unread, peer_delivered, peer_read
    return unread_count, first_unread, peer_setting.last_delivered_message_id if peer_setting else None, peer_setting.last_read_message_id if peer_setting and _receipt_visible(session, conversation, viewer) else None


def _advance_cursor(conversation: Conversation, setting: ConversationSetting, field: str, message_id: uuid.UUID) -> None:
    if _message_index(conversation, message_id) > _message_index(conversation, getattr(setting, field)):
        setattr(setting, field, message_id)


def _composer_state(session: Session, conversation: Conversation | None, user: User, other: User) -> tuple[bool, str, str]:
    if conversation and _is_blocked(session, user, other):
        return False, "Chat unavailable.", "blocked"
    if conversation and conversation.status == ConversationStatus.declined:
        return False, "Chat unavailable.", "declined"
    if conversation is None:
        if can_initiate_chat_request(session, user):
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
    members = _active_members(session, conversation.id)
    other_members = [member for member in members if member.id != viewer.id]
    participant = other_members[0] if other_members else viewer
    if conversation.conversation_type == ConversationType.group:
        can_send = bool(_membership(session, conversation.id, viewer.id)) and not _is_group_blocked(session, conversation, viewer)
        placeholder = "Write a message..." if can_send else "Chat unavailable."
    else:
        can_send, placeholder, _ = _composer_state(session, conversation, viewer, participant)
    setting = _get_setting(session, conversation.id, viewer.id)
    latest = conversation.messages[-1] if conversation.messages else None
    unread_count, _, _, _ = _receipt_summary(session, conversation, viewer)
    _, peer_setting = _receipt_cursors(session, conversation, viewer)
    latest_sender = session.get(User, latest.sender_id) if latest else None
    return ConversationResponse(
        id=conversation.id,
        conversation_type=conversation.conversation_type.value,
        participant=ChatUserResponse(id=participant.public_id, username=participant.username, display_name=participant.display_name, profile_picture_url=profile_picture_url_for(participant), show_professional_badge=participant.show_professional_badge),
        participants=[ChatUserResponse(id=member.public_id, username=member.username, display_name=member.display_name, profile_picture_url=profile_picture_url_for(member), show_professional_badge=member.show_professional_badge) for member in members],
        preview=latest.content if latest and latest.content else "Image" if latest and latest.media else None,
        preview_sender_id=latest_sender.public_id if latest_sender else None,
        preview_receipt_status=_receipt_status(session, conversation, latest, viewer, peer_setting) if latest else None,
        updated_at=conversation.updated_at,
        status=conversation.status.value,
        unread=unread_count > 0,
        requester_id=session.get(User, conversation.requester_id).public_id if conversation.requester_id else None,
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
    conversation = _find_direct_conversation(session, user_one_id, user_two_id, load_messages=True)
    if not conversation and await _has_mutual_connection(session, user, other):
        conversation = Conversation(user_one_id=user_one_id, user_two_id=user_two_id, status=ConversationStatus.accepted)
        session.add(conversation)
        session.flush()
        session.add_all([
            ConversationMember(conversation_id=conversation.id, user_id=user_one_id, role="member"),
            ConversationMember(conversation_id=conversation.id, user_id=user_two_id, role="member"),
        ])
        await commit(session)
        await refresh(session, conversation)
        conversation.messages = []
    if conversation:
        response = _conversation_response(session, conversation, user)
        setting = _get_setting(session, conversation.id, user.id)
        return ChatContextResponse(conversation=response, participant=response.participant, can_send=response.can_send, composer_placeholder=response.composer_placeholder, status=response.status, requester_message_count=response.requester_message_count, unread_count=response.unread_count, last_read_message_id=setting.last_read_message_id if setting else None)
    can_send, placeholder, state = _composer_state(session, None, user, other)
    participant = ChatUserResponse(id=other.public_id, username=other.username, display_name=other.display_name, profile_picture_url=profile_picture_url_for(other), show_professional_badge=other.show_professional_badge)
    return ChatContextResponse(conversation=None, participant=participant, can_send=can_send, composer_placeholder=placeholder, status=state)


async def get_chat_context_by_id(session: Session, user: User, conversation_id: uuid.UUID) -> ChatContextResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    response = _conversation_response(session, conversation, user)
    setting = _get_setting(session, conversation.id, user.id)
    return ChatContextResponse(
        conversation=response,
        participant=response.participant,
        can_send=response.can_send,
        composer_placeholder=response.composer_placeholder,
        status=response.status,
        requester_message_count=response.requester_message_count,
        unread_count=response.unread_count,
        last_read_message_id=setting.last_read_message_id if setting else None,
    )


async def list_conversations(session: Session, user: User) -> ConversationListResponse:
    statement = (
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .options(selectinload(Conversation.messages).selectinload(Message.media))
        .where(ConversationMember.user_id == user.id, ConversationMember.left_at.is_(None))
        .order_by(Conversation.updated_at.desc())
    )
    if not get_settings().group_chat_enabled:
        statement = statement.where(Conversation.conversation_type == ConversationType.direct)
    conversations = session.execute(statement).scalars().all()
    changed = False
    for conversation in conversations:
        if _conversation_is_blocked(session, conversation, user):
            continue
        incoming = [message for message in conversation.messages if message.sender_id != user.id]
        if not incoming:
            continue
        setting = _get_setting(session, conversation.id, user.id)
        if not setting:
            setting = ConversationSetting(conversation_id=conversation.id, user_id=user.id)
            session.add(setting)
            changed = True
        previous = setting.last_delivered_message_id
        _advance_cursor(conversation, setting, "last_delivered_message_id", incoming[-1].id)
        changed = changed or setting.last_delivered_message_id != previous
    if changed:
        await commit(session)
    return ConversationListResponse(items=[_conversation_response(session, conversation, user) for conversation in conversations])


def _group_response(session: Session, conversation: Conversation) -> GroupConversationResponse:
    return GroupConversationResponse(
        id=conversation.id,
        conversation_type=conversation.conversation_type.value,
        members=[
            ChatUserResponse(
                id=member.public_id,
                username=member.username,
                display_name=member.display_name,
                profile_picture_url=profile_picture_url_for(member),
                show_professional_badge=member.show_professional_badge,
            )
            for member in _active_members(session, conversation.id)
        ],
    )


async def _resolve_group_members(session: Session, actor: User, usernames: list[str]) -> list[User]:
    normalized = [username.strip().casefold() for username in usernames]
    if len(set(normalized)) != len(normalized):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Group members must be unique.")
    members: list[User] = []
    for username in usernames:
        member = await get_user_by_username(session, username.strip())
        if not member or member.id == actor.id or member.deleted_at is not None or member.lifecycle_status != "active":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="A group member is unavailable.")
        if member.is_private and not session.execute(
            select(FollowRequest.id).where(
                FollowRequest.requester_id == actor.id,
                FollowRequest.recipient_id == member.id,
                FollowRequest.status == FollowRequestStatus.accepted,
            )
        ).first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="A group member is unavailable.")
        members.append(member)
    return members


def _ensure_no_blocked_group_pairs(session: Session, members: list[User]) -> None:
    for index, member in enumerate(members):
        if any(_is_blocked(session, member, other) for other in members[index + 1:]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A group member is unavailable.")


async def create_group_conversation(session: Session, creator: User, usernames: list[str]) -> GroupConversationResponse:
    _require_group_chat_enabled()
    invitees = await _resolve_group_members(session, creator, usernames)
    members = [creator, *invitees]
    _ensure_no_blocked_group_pairs(session, members)
    conversation = Conversation(
        conversation_type=ConversationType.group,
        status=ConversationStatus.accepted,
        user_one_id=None,
        user_two_id=None,
    )
    session.add(conversation)
    session.flush()
    session.add_all([
        ConversationMember(conversation_id=conversation.id, user_id=creator.id, role="admin"),
        *(ConversationMember(conversation_id=conversation.id, user_id=member.id, role="member") for member in invitees),
    ])
    await commit(session)
    return _group_response(session, conversation)


def _require_group_admin(session: Session, conversation: Conversation, actor: User) -> ConversationMember:
    membership = _membership(session, conversation.id, actor.id)
    if not membership or membership.left_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only group admins can manage members.")
    return membership


async def add_group_members(session: Session, actor: User, conversation_id: uuid.UUID, usernames: list[str]) -> GroupConversationResponse:
    _require_group_chat_enabled()
    conversation = await _get_conversation(session, conversation_id, actor)
    if conversation.conversation_type != ConversationType.group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Member operations require a group conversation.")
    _require_group_admin(session, conversation, actor)
    invitees = await _resolve_group_members(session, actor, usernames)
    current_members = _active_members(session, conversation.id)
    _ensure_no_blocked_group_pairs(session, [*current_members, *invitees])
    for invitee in invitees:
        membership = _membership(session, conversation.id, invitee.id)
        if membership and membership.left_at is None:
            continue
        if membership:
            membership.left_at = None
            membership.joined_at = datetime.now(UTC)
            membership.role = "member"
        else:
            session.add(ConversationMember(conversation_id=conversation.id, user_id=invitee.id, role="member"))
    conversation.updated_at = datetime.now(UTC)
    await commit(session)
    return _group_response(session, conversation)


async def remove_group_member(session: Session, actor: User, conversation_id: uuid.UUID, username: str) -> GroupConversationResponse:
    _require_group_chat_enabled()
    conversation = await _get_conversation(session, conversation_id, actor)
    if conversation.conversation_type != ConversationType.group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Member operations require a group conversation.")
    target = await get_user_by_username(session, username)
    membership = _membership(session, conversation.id, target.id) if target else None
    if not target or not membership or membership.left_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group member not found.")
    actor_membership = _membership(session, conversation.id, actor.id)
    if actor.id != target.id and (not actor_membership or actor_membership.role != "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only group admins can remove another member.")
    if membership.role == "admin":
        other_admin = session.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conversation.id,
                ConversationMember.left_at.is_(None),
                ConversationMember.role == "admin",
                ConversationMember.user_id != target.id,
            )
        ).first()
        if not other_admin:
            successor = session.execute(
                select(ConversationMember).where(
                    ConversationMember.conversation_id == conversation.id,
                    ConversationMember.left_at.is_(None),
                    ConversationMember.user_id != target.id,
                ).order_by(ConversationMember.joined_at, ConversationMember.user_id)
            ).scalars().first()
            if successor:
                successor.role = "admin"
    membership.left_at = datetime.now(UTC)
    conversation.updated_at = datetime.now(UTC)
    await commit(session)
    return _group_response(session, conversation)


async def set_group_member_role(session: Session, actor: User, conversation_id: uuid.UUID, username: str, role: str) -> GroupConversationResponse:
    _require_group_chat_enabled()
    conversation = await _get_conversation(session, conversation_id, actor)
    if conversation.conversation_type != ConversationType.group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Member operations require a group conversation.")
    _require_group_admin(session, conversation, actor)
    target = await get_user_by_username(session, username)
    membership = _membership(session, conversation.id, target.id) if target else None
    if not target or not membership or membership.left_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group member not found.")
    if membership.role == "admin" and role != "admin":
        other_admin = session.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conversation.id,
                ConversationMember.left_at.is_(None),
                ConversationMember.role == "admin",
                ConversationMember.user_id != target.id,
            )
        ).first()
        if not other_admin:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A group must keep at least one admin.")
    membership.role = role
    await commit(session)
    return _group_response(session, conversation)


async def _get_conversation(session: Session, conversation_id: uuid.UUID, user: User) -> Conversation:
    conversation = session.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages).selectinload(Message.media))
        .where(Conversation.id == conversation_id)
    ).scalar_one_or_none()
    membership = _membership(session, conversation.id, user.id) if conversation else None
    if not conversation or not membership or membership.left_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    if conversation.conversation_type == ConversationType.group and not get_settings().group_chat_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Group chats are not available.")
    return conversation


def _notify_if_unmuted(session: Session, conversation: Conversation, recipient: User, actor: User, notification_type: NotificationType) -> None:
    if not _muted(session, conversation.id, recipient.id):
        create_notification(session, recipient_user_id=recipient.id, actor_user_id=actor.id, notification_type=notification_type, payload={"conversation_id": str(conversation.id), "actor_username": actor.username, "actor_display_name": actor.display_name})


def _notify_group_members(session: Session, conversation: Conversation, actor: User) -> None:
    for recipient in _conversation_other_members(session, conversation, actor.id):
        _notify_if_unmuted(session, conversation, recipient, actor, NotificationType.chat_message)


async def _send_in_conversation(session: Session, conversation: Conversation, user: User, content: str, client_message_id: str, media: list[tuple[str, str | None]] | None = None) -> MessageResponse:
    other = _participant(session, conversation, user.id)
    if conversation.conversation_type == ConversationType.group:
        if _is_group_blocked(session, conversation, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
    else:
        if conversation.status == ConversationStatus.declined:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
        if _is_blocked(session, user, other):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
        if conversation.status == ConversationStatus.accepted and not _has_mutual_connection_sync(session, user, other):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
    content = content.strip()
    if not content and not media:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message content or media is required.")
    existing = session.execute(select(Message).where(Message.conversation_id == conversation.id, Message.client_message_id == client_message_id)).scalar_one_or_none()
    if existing:
        return _message_response(session, conversation, existing, user)
    was_pending = conversation.conversation_type == ConversationType.direct and conversation.status == ConversationStatus.pending
    was_requester = conversation.requester_id == user.id
    if was_pending and was_requester and conversation.requester_message_count >= MAX_PENDING_REQUEST_MESSAGES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request pending.")
    if was_pending and not was_requester:
        conversation.status = ConversationStatus.accepted
    message = Message(conversation_id=conversation.id, sender_id=user.id, content=content, client_message_id=client_message_id)
    session.add(message)
    for storage_key, url in media or []:
        message.media.append(MessageMedia(storage_key=storage_key, url=url))
    if was_pending and was_requester:
        first = conversation.requester_message_count == 0
        conversation.requester_message_count += 1
        _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_request_received if first else NotificationType.chat_message)
    elif was_pending and not was_requester:
        _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_request_accepted)
    elif conversation.conversation_type == ConversationType.group:
        _notify_group_members(session, conversation, user)
    else:
        _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_message)
    conversation.updated_at = datetime.now(UTC)
    await commit(session)
    await refresh(session, message)
    return _message_response(session, conversation, message, user)


async def send_message(session: Session, user: User, conversation_id: uuid.UUID, content: str, client_message_id: str, media: list[tuple[str, str | None]] | None = None) -> MessageResponse:
    return await _send_in_conversation(session, await _get_conversation(session, conversation_id, user), user, content, client_message_id, media)


async def send_message_to_user(session: Session, user: User, username: str, content: str, client_message_id: str, media: list[tuple[str, str | None]] | None = None) -> tuple[MessageResponse, Conversation]:
    other = await get_user_by_username(session, username)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if other.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot message yourself.")
    user_one_id, user_two_id = sorted((user.id, other.id), key=str)
    conversation = _find_direct_conversation(session, user_one_id, user_two_id, load_messages=True)
    mutual = await _has_mutual_connection(session, user, other)
    if not conversation:
        if _is_blocked(session, user, other):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat unavailable.")
        if not mutual and not can_initiate_chat_request(session, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A paid plan is required to start a chat request.")
        conversation = Conversation(user_one_id=user_one_id, user_two_id=user_two_id, status=ConversationStatus.accepted if mutual else ConversationStatus.pending, requester_id=None if mutual else user.id)
        session.add(conversation)
        session.flush()
        session.add_all([
            ConversationMember(conversation_id=conversation.id, user_id=user_one_id, role="member"),
            ConversationMember(conversation_id=conversation.id, user_id=user_two_id, role="member"),
        ])
        await commit(session)
        await refresh(session, conversation)
        conversation.messages = []
    return await _send_in_conversation(session, conversation, user, content, client_message_id, media), conversation


async def accept_request(session: Session, user: User, conversation_id: uuid.UUID) -> ConversationResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    if conversation.status != ConversationStatus.pending or conversation.requester_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a pending received request can be accepted.")
    other = _participant(session, conversation, user.id)
    conversation.status = ConversationStatus.accepted
    conversation.updated_at = datetime.now(UTC)
    _notify_if_unmuted(session, conversation, other, user, NotificationType.chat_request_accepted)
    await commit(session)
    return _conversation_response(session, conversation, user)


async def reject_request(session: Session, user: User, conversation_id: uuid.UUID) -> ConversationResponse:
    conversation = await _get_conversation(session, conversation_id, user)
    if conversation.status != ConversationStatus.pending or conversation.requester_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a pending received request can be declined.")
    conversation.status = ConversationStatus.declined
    conversation.updated_at = datetime.now(UTC)
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
    statement = select(Message).options(selectinload(Message.media)).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc(), Message.id.asc()).limit(MESSAGE_PAGE_SIZE + 1)
    if cursor:
        created_at, message_id = _decode_cursor(cursor)
        statement = statement.where(or_(Message.created_at > created_at, and_(Message.created_at == created_at, Message.id > message_id)))
    messages = session.execute(statement).scalars().all()
    has_more = len(messages) > MESSAGE_PAGE_SIZE
    items = messages[:MESSAGE_PAGE_SIZE]
    viewer_setting, _ = _receipt_cursors(session, conversation, user)
    if not _conversation_is_blocked(session, conversation, user):
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
    if not _conversation_is_blocked(session, conversation, user):
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
