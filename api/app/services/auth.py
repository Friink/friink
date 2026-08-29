from datetime import UTC, datetime, timedelta
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.auth import SignupRequest, UpdateCurrentUserRequest
from app.services.auth_errors import AuthErrorCode, auth_error_detail
from app.services.email import EmailService
from app.services.notifications import create_notification
from app.services.session_ops import commit, refresh
from app.services.security import hash_password, verify_password

LOCKOUT_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(hours=3)


async def get_user_by_email(session: Session, email: str) -> User | None:
    result = session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_username(session: Session, username: str) -> User | None:
    result = session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_user(session: Session, data: SignupRequest, email_service: EmailService | None = None) -> User:
    if await get_user_by_email(session, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    if await get_user_by_username(session, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    user = User(
        email=data.email.lower(),
        username=data.username,
        display_name=data.display_name or data.username,
        is_private=False,
        password_hash=hash_password(data.password),
        date_of_birth=data.date_of_birth,
        location=data.location,
        is_verified=True,
    )
    session.add(user)
    await commit(session)
    await refresh(session, user)

    # TODO: once OTP verification is reintroduced, keep incomplete registrations
    # reusable by cleaning up or expiring unverified rows before uniqueness checks.
    # TODO: wire up OTP once email is configured.
    if email_service:
        await email_service.send_registration_successful(user)
    return user


async def update_current_user(session: Session, user: User, data: UpdateCurrentUserRequest) -> User:
    changed = False
    was_private = user.is_private

    if data.username is not None and data.username != user.username:
        existing_user = await get_user_by_username(session, data.username)
        if existing_user and existing_user.id != user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")
        user.username = data.username
        changed = True

    if data.email is not None:
        normalized_email = data.email.lower()
        if normalized_email != user.email:
            existing_user = await get_user_by_email(session, normalized_email)
            if existing_user and existing_user.id != user.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
            user.email = normalized_email
            changed = True

    if data.display_name is not None and data.display_name != user.display_name:
        user.display_name = data.display_name
        changed = True

    if data.about is not None and data.about != user.about:
        user.about = data.about
        changed = True

    if data.is_private is not None and data.is_private != user.is_private:
        user.is_private = data.is_private
        changed = True

    if was_private and data.is_private is False:
        now = datetime.now(UTC)
        pending_requests = session.execute(
            select(FollowRequest).where(
                FollowRequest.recipient_id == user.id,
                FollowRequest.status == FollowRequestStatus.pending,
            )
        ).scalars().all()
        for request in pending_requests:
            request.status = FollowRequestStatus.accepted
            request.responded_at = now
            create_notification(
                session,
                recipient_user_id=request.requester_id,
                actor_user_id=user.id,
                notification_type=NotificationType.request_accepted,
                payload={
                    "connection_id": str(request.id),
                    "requester_username": request.requester.username if request.requester else None,
                    "recipient_username": user.username,
                    "recipient_display_name": user.display_name,
                },
            )

    if not changed:
        return user

    await commit(session)
    await refresh(session, user)
    return user


async def authenticate_user(session: Session, email: str, password: str) -> User:
    user = await get_user_by_email(session, email)
    now = datetime.now(UTC)

    if user and user.locked_until and user.locked_until > now:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked, try again after {user.locked_until.isoformat()}.",
        )

    if not user or not verify_password(password, user.password_hash):
        if user:
            await register_failed_login(session, user)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    user.failed_login_attempts = 0
    user.locked_until = None
    await commit(session)
    await refresh(session, user)
    # TODO: insert OTP challenge here between password check and token issuance, once email is configured.
    return user


async def register_failed_login(session: Session, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= LOCKOUT_ATTEMPTS:
        user.locked_until = datetime.now(UTC) + LOCKOUT_DURATION
        user.failed_login_attempts = 0
    await commit(session)


def user_id_from_subject(subject: str) -> uuid.UUID:
    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid token.", AuthErrorCode.TOKEN_SCHEMA_INVALID),
        ) from exc
