from datetime import UTC, datetime, timedelta
import hashlib
import secrets
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.models.identity_history import UserEmailHistory, UserUsernameHistory
from app.models.reserved_username import ReservedUsername
from app.models.signup_reservation import SignupReservation
from app.schemas.auth import ChangePasswordRequest, SignupRequest, UpdateCurrentUserRequest
from app.services.auth_errors import AuthErrorCode, auth_error_detail
from app.services.email import EmailService
from app.services.notifications import create_notification
from app.services.otp import issue_signup_otp, verify_signup_otp
from app.services.session_ops import commit, refresh
from app.services.security import hash_password, verify_password

LOCKOUT_SCHEDULE = ((3, timedelta(minutes=30)), (4, timedelta(hours=1)), (5, timedelta(hours=24)))
LOCKOUT_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(hours=24)
SIGNUP_MESSAGE = "If the signup details can be accepted, verification instructions will be sent."


async def get_user_by_email(session: Session, email: str) -> User | None:
    result = session.execute(select(User).where(func.lower(User.email) == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_username(session: Session, username: str) -> User | None:
    result = session.execute(select(User).where(User.username_key == username.casefold()))
    return result.scalar_one_or_none()


async def is_username_available(session: Session, username: str, exclude_user_id: uuid.UUID | None = None) -> bool:
    existing_user = await get_user_by_username(session, username)
    if existing_user is not None and existing_user.id != exclude_user_id:
        return False
    return session.execute(select(ReservedUsername.id).where(ReservedUsername.username_key == username.casefold(), ReservedUsername.active.is_(True))).scalar_one_or_none() is None


async def create_user(session: Session, data: SignupRequest, email_service: EmailService | None = None) -> User:
    if await get_user_by_email(session, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    if not await is_username_available(session, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    user = User(
        email=data.email.lower(),
        username=data.username,
        username_key=data.username.casefold(),
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
    session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="created"))
    session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="created"))
    await commit(session)

    # TODO: once OTP verification is reintroduced, keep incomplete registrations
    # reusable by cleaning up or expiring unverified rows before uniqueness checks.
    # TODO: wire up OTP once email is configured.
    if email_service:
        await email_service.send_registration_successful(user)
    return user


def _reservation_token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii")).digest()


async def start_signup_reservation(session: Session, data: SignupRequest, email_service: EmailService) -> str:
    normalized_email = str(data.email).strip().casefold()
    # Check email first so an existing address never reveals whether its
    # submitted username is available or reserved.
    if await get_user_by_email(session, normalized_email):
        return secrets.token_urlsafe(32)
    if not await is_username_available(session, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    token = secrets.token_urlsafe(32)
    reservation = SignupReservation(
        token_hash=_reservation_token_hash(token),
        email=normalized_email,
        username=data.username,
        username_key=data.username.casefold(),
        display_name=data.display_name or data.username,
        password_hash=hash_password(data.password),
        date_of_birth=data.date_of_birth,
        location=data.location,
    )
    session.add(reservation)
    session.flush()
    otp_code = issue_signup_otp(session, reservation)
    await email_service.send_signup_otp(reservation.email, otp_code)
    await commit(session)
    return token


async def complete_signup_reservation(session: Session, token: str, otp: str) -> User:
    reservation = session.execute(
        select(SignupReservation).where(SignupReservation.token_hash == _reservation_token_hash(token))
    ).scalar_one_or_none()
    if not reservation or not verify_signup_otp(session, reservation, otp):
        await commit(session)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")

    if await get_user_by_email(session, reservation.email) or not await is_username_available(session, reservation.username):
        await commit(session)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")

    user = User(
        email=reservation.email,
        username=reservation.username,
        username_key=reservation.username_key,
        display_name=reservation.display_name,
        is_private=False,
        password_hash=reservation.password_hash,
        date_of_birth=reservation.date_of_birth,
        location=reservation.location,
        is_verified=True,
    )
    session.add(user)
    await commit(session)
    await refresh(session, user)
    session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="created"))
    session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="created"))
    session.delete(reservation)
    await commit(session)
    return user


async def update_current_user(session: Session, user: User, data: UpdateCurrentUserRequest) -> User:
    changed = False
    was_private = user.is_private

    if data.username is not None and data.username != user.username:
        if not await is_username_available(session, data.username, exclude_user_id=user.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")
        old_username = user.username
        user.username = data.username
        user.username_key = data.username.casefold()
        session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="changed"))
        changed = True

    if data.email is not None:
        normalized_email = data.email.lower()
        if normalized_email != user.email:
            existing_user = await get_user_by_email(session, normalized_email)
            if existing_user and existing_user.id != user.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
            old_email = user.email
            user.email = normalized_email
            session.add(UserEmailHistory(user_id=user.id, email_value=old_email, event_type="replaced"))
            session.add(UserEmailHistory(user_id=user.id, email_value=normalized_email, event_type="changed"))
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

    if data.likes_visible is not None and data.likes_visible != user.likes_visible:
        user.likes_visible = data.likes_visible
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


async def change_password(session: Session, user: User, data: ChangePasswordRequest) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    user.password_hash = hash_password(data.new_password)
    await commit(session)


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
    for threshold, duration in reversed(LOCKOUT_SCHEDULE):
        if user.failed_login_attempts >= threshold:
            user.locked_until = datetime.now(UTC) + duration
            break
    await commit(session)


def user_id_from_subject(subject: str) -> uuid.UUID:
    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid token.", AuthErrorCode.TOKEN_SCHEMA_INVALID),
        ) from exc
