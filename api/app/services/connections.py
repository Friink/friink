import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.connections import (
    ConnectionListResponse,
    ConnectionStatusResponse,
    ConnectionUserResponse,
    FollowRequestResponse,
    SendFollowRequestPayload,
)
from app.services.auth import get_user_by_username
from app.services.notifications import create_notification
from app.services.session_ops import commit


def _now() -> datetime:
    return datetime.now(UTC)


DENIAL_COOLDOWN = timedelta(hours=24)
FOLLOWER_REMOVAL_COOLDOWN = timedelta(hours=24)
CANCEL_WINDOW = timedelta(hours=3)
CANCEL_LOCKOUT = timedelta(hours=24)
CANCEL_LOCKOUT_THRESHOLD = 3


async def send_follow_request(session: Session, requester: User, payload: SendFollowRequestPayload) -> FollowRequest:
    recipient = await _get_recipient(session, payload)
    if recipient.id == requester.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot follow yourself.")

    existing_pending = await _get_pair_request(
        session,
        requester.id,
        recipient.id,
        FollowRequestStatus.pending,
    )
    if existing_pending:
        return existing_pending

    existing_accepted = await _get_pair_request(
        session,
        requester.id,
        recipient.id,
        FollowRequestStatus.accepted,
    )
    if existing_accepted:
        return existing_accepted

    latest_removed = await _get_latest_removed_follower_request(session, requester.id, recipient.id)
    if latest_removed and latest_removed.removed_at and latest_removed.removed_at + FOLLOWER_REMOVAL_COOLDOWN > _now():
        retry_at = latest_removed.removed_at + FOLLOWER_REMOVAL_COOLDOWN
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can follow this account again after {retry_at.isoformat()}.",
        )

    if recipient.is_private:
        latest_rejected = await _get_latest_rejected_request(session, requester.id, recipient.id)
        if latest_rejected and latest_rejected.responded_at and latest_rejected.responded_at + DENIAL_COOLDOWN > _now():
            retry_at = latest_rejected.responded_at + DENIAL_COOLDOWN
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You can send another follow request after {retry_at.isoformat()}.",
            )
        await _raise_if_cancel_resend_locked(session, requester.id, recipient.id)

    request = FollowRequest(
        requester_id=requester.id,
        recipient_id=recipient.id,
        status=FollowRequestStatus.pending if recipient.is_private else FollowRequestStatus.accepted,
        responded_at=None if recipient.is_private else _now(),
    )
    session.add(request)
    if recipient.is_private:
        create_notification(
            session,
            recipient_user_id=requester.id,
            actor_user_id=requester.id,
            notification_type=NotificationType.request_sent,
            payload=_connection_payload(requester, recipient, request.id),
        )
        create_notification(
            session,
            recipient_user_id=recipient.id,
            actor_user_id=requester.id,
            notification_type=NotificationType.request_received,
            payload=_connection_payload(requester, recipient, request.id),
        )
    else:
        create_notification(
            session,
            recipient_user_id=requester.id,
            actor_user_id=requester.id,
            notification_type=NotificationType.follow_sent_public,
            payload=_connection_payload(requester, recipient, request.id),
        )
        create_notification(
            session,
            recipient_user_id=recipient.id,
            actor_user_id=requester.id,
            notification_type=NotificationType.new_follower,
            payload=_connection_payload(requester, recipient, request.id),
        )
    await commit(session)
    return await get_follow_request(session, request.id)


async def accept_follow_request(session: Session, actor: User, request_id: uuid.UUID) -> FollowRequest:
    request = await get_follow_request(session, request_id)
    _require_recipient(actor, request)
    _require_pending(request, "Only pending follow requests can be accepted.")
    request.status = FollowRequestStatus.accepted
    request.responded_at = _now()
    create_notification(
        session,
        recipient_user_id=request.requester_id,
        actor_user_id=actor.id,
        notification_type=NotificationType.request_accepted,
        payload=_connection_payload(request.requester, request.recipient, request.id),
    )
    await commit(session)
    return await get_follow_request(session, request.id)


async def reject_follow_request(session: Session, actor: User, request_id: uuid.UUID) -> FollowRequest:
    request = await get_follow_request(session, request_id)
    _require_recipient(actor, request)
    _require_pending(request, "Only pending follow requests can be rejected.")
    request.status = FollowRequestStatus.rejected
    request.responded_at = _now()
    request.removed_at = None
    await commit(session)
    return await get_follow_request(session, request.id)


async def cancel_follow_request(session: Session, actor: User, request_id: uuid.UUID) -> FollowRequest:
    request = await get_follow_request(session, request_id)
    if request.requester_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the requester can cancel this follow request.")
    _require_pending(request, "Only pending follow requests can be canceled.")
    request.status = FollowRequestStatus.canceled
    request.responded_at = _now()
    request.removed_at = None
    await commit(session)
    return await get_follow_request(session, request.id)


async def remove_connection(session: Session, actor: User, request_id: uuid.UUID) -> FollowRequest:
    request = await get_follow_request(session, request_id)
    if actor.id not in {request.requester_id, request.recipient_id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only either party can remove this connection.")
    if request.status != FollowRequestStatus.accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only accepted connections can be removed.")
    request.status = FollowRequestStatus.canceled
    request.responded_at = _now()
    request.removed_at = None
    await commit(session)
    return await get_follow_request(session, request.id)


async def remove_follower(session: Session, actor: User, follower_username: str) -> FollowRequest:
    follower = await get_user_by_username(session, follower_username)
    if not follower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follower user was not found.")

    request = await _get_pair_request(session, follower.id, actor.id, FollowRequestStatus.accepted)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follower relationship was not found.")

    request.status = FollowRequestStatus.canceled
    request.responded_at = _now()
    request.removed_at = request.responded_at
    await commit(session)
    return await get_follow_request(session, request.id)


async def list_followers(session: Session, user: User) -> ConnectionListResponse:
    result = session.execute(
        select(User)
        .join(FollowRequest, FollowRequest.requester_id == User.id)
        .where(FollowRequest.recipient_id == user.id, FollowRequest.status == FollowRequestStatus.accepted)
        .order_by(User.username)
    )
    users = [serialize_connection_user(item) for item in result.scalars().all()]
    return ConnectionListResponse(users=users, count=len(users))


async def list_following(session: Session, user: User) -> ConnectionListResponse:
    result = session.execute(
        select(User)
        .join(FollowRequest, FollowRequest.recipient_id == User.id)
        .where(FollowRequest.requester_id == user.id, FollowRequest.status == FollowRequestStatus.accepted)
        .order_by(User.username)
    )
    users = [serialize_connection_user(item) for item in result.scalars().all()]
    return ConnectionListResponse(users=users, count=len(users))


async def list_incoming_pending(session: Session, user: User) -> list[FollowRequest]:
    return await _list_requests(session, FollowRequest.recipient_id == user.id, FollowRequestStatus.pending)


async def list_outgoing_pending(session: Session, user: User) -> list[FollowRequest]:
    return await _list_requests(session, FollowRequest.requester_id == user.id, FollowRequestStatus.pending)


async def get_connection_status(session: Session, actor: User, username: str) -> ConnectionStatusResponse:
    other = await get_user_by_username(session, username)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User was not found.")
    if other.id == actor.id:
        return ConnectionStatusResponse(user=serialize_connection_user(other), state="self")

    result = session.execute(
        select(FollowRequest)
        .options(selectinload(FollowRequest.requester), selectinload(FollowRequest.recipient))
        .where(
            FollowRequest.requester_id == actor.id,
            FollowRequest.recipient_id == other.id,
            FollowRequest.status.in_([FollowRequestStatus.pending, FollowRequestStatus.accepted]),
        )
        .order_by(FollowRequest.created_at.desc())
    )
    request = result.scalars().first()
    if not request:
        return ConnectionStatusResponse(user=serialize_connection_user(other), state="none")
    return ConnectionStatusResponse(user=serialize_connection_user(other), state="following" if request.status == FollowRequestStatus.accepted else "requested", request=serialize_follow_request(request))


async def get_user_for_public_connections(session: Session, username: str) -> User:
    user = await get_user_by_username(session, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User was not found.")
    return user


async def get_follow_request(session: Session, request_id: uuid.UUID) -> FollowRequest:
    result = session.execute(
        select(FollowRequest)
        .options(selectinload(FollowRequest.requester), selectinload(FollowRequest.recipient))
        .where(FollowRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow request was not found.")
    return request


def serialize_connection_user(user: User) -> ConnectionUserResponse:
    return ConnectionUserResponse(id=user.id, username=user.username, is_private=user.is_private)


def serialize_follow_request(request: FollowRequest) -> FollowRequestResponse:
    return FollowRequestResponse(
        id=request.id,
        requester=serialize_connection_user(request.requester),
        recipient=serialize_connection_user(request.recipient),
        status=request.status,
        created_at=request.created_at,
        responded_at=request.responded_at,
        removed_at=request.removed_at,
    )


def _connection_payload(requester: User, recipient: User, request_id: uuid.UUID) -> dict:
    return {
        "connection_id": str(request_id),
        "requester_username": requester.username,
        "requester_display_name": requester.display_name,
        "recipient_username": recipient.username,
        "recipient_display_name": recipient.display_name,
    }


async def _get_recipient(session: Session, payload: SendFollowRequestPayload) -> User:
    recipient = session.get(User, payload.recipient_id) if payload.recipient_id else None
    if not recipient and payload.recipient_username:
        recipient = await get_user_by_username(session, payload.recipient_username)
    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user was not found.")
    return recipient


async def _get_pair_request(
    session: Session,
    requester_id: uuid.UUID,
    recipient_id: uuid.UUID,
    request_status: FollowRequestStatus,
) -> FollowRequest | None:
    result = session.execute(
        select(FollowRequest)
        .options(selectinload(FollowRequest.requester), selectinload(FollowRequest.recipient))
        .where(
            FollowRequest.requester_id == requester_id,
            FollowRequest.recipient_id == recipient_id,
            FollowRequest.status == request_status,
        )
        .order_by(FollowRequest.created_at.desc())
    )
    return result.scalars().first()


async def _get_latest_rejected_request(
    session: Session,
    requester_id: uuid.UUID,
    recipient_id: uuid.UUID,
) -> FollowRequest | None:
    result = session.execute(
        select(FollowRequest)
        .options(selectinload(FollowRequest.requester), selectinload(FollowRequest.recipient))
        .where(
            FollowRequest.requester_id == requester_id,
            FollowRequest.recipient_id == recipient_id,
            FollowRequest.status == FollowRequestStatus.rejected,
        )
        .order_by(FollowRequest.responded_at.desc(), FollowRequest.created_at.desc())
    )
    return result.scalars().first()


async def _raise_if_cancel_resend_locked(session: Session, requester_id: uuid.UUID, recipient_id: uuid.UUID) -> None:
    canceled_requests = await _get_canceled_sender_requests(session, requester_id, recipient_id)
    if not canceled_requests:
        return

    now = _now()
    latest_cancel = canceled_requests[0].responded_at
    if not latest_cancel:
        return
    cycle_start = latest_cancel
    cycle_count = 0
    for request in canceled_requests:
        if not request.responded_at:
            continue
        if cycle_start - request.responded_at <= CANCEL_WINDOW:
            cycle_start = request.responded_at
            cycle_count += 1
        else:
            break

    if cycle_count >= CANCEL_LOCKOUT_THRESHOLD and cycle_start + CANCEL_LOCKOUT > now:
        retry_at = cycle_start + CANCEL_LOCKOUT
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can send another follow request after {retry_at.isoformat()}.",
        )


async def _get_canceled_sender_requests(session: Session, requester_id: uuid.UUID, recipient_id: uuid.UUID) -> list[FollowRequest]:
    result = session.execute(
        select(FollowRequest)
        .where(
            FollowRequest.requester_id == requester_id,
            FollowRequest.recipient_id == recipient_id,
            FollowRequest.status == FollowRequestStatus.canceled,
            FollowRequest.removed_at.is_(None),
            FollowRequest.responded_at.is_not(None),
        )
        .order_by(FollowRequest.responded_at.desc(), FollowRequest.created_at.desc())
    )
    return list(result.scalars().all())


async def _get_latest_removed_follower_request(
    session: Session,
    requester_id: uuid.UUID,
    recipient_id: uuid.UUID,
) -> FollowRequest | None:
    result = session.execute(
        select(FollowRequest)
        .options(selectinload(FollowRequest.requester), selectinload(FollowRequest.recipient))
        .where(
            FollowRequest.requester_id == requester_id,
            FollowRequest.recipient_id == recipient_id,
            FollowRequest.removed_at.is_not(None),
        )
        .order_by(FollowRequest.removed_at.desc(), FollowRequest.created_at.desc())
    )
    return result.scalars().first()


async def _list_requests(session: Session, criterion, request_status: FollowRequestStatus) -> list[FollowRequest]:
    result = session.execute(
        select(FollowRequest)
        .options(selectinload(FollowRequest.requester), selectinload(FollowRequest.recipient))
        .where(criterion, FollowRequest.status == request_status)
        .order_by(FollowRequest.created_at.desc())
    )
    return list(result.scalars().all())


def _require_recipient(actor: User, request: FollowRequest) -> None:
    if request.recipient_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the recipient can respond to this follow request.")


def _require_pending(request: FollowRequest, message: str) -> None:
    if request.status != FollowRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
