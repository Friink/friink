from datetime import UTC, datetime, timedelta
import hashlib
import secrets
import uuid

from fastapi import HTTPException, status
from fastapi.background import BackgroundTasks
from sqlalchemy import delete, func, select
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
from app.models.security_event import SecurityEvent, SecurityEventType
from app.services.security_events import record_security_event_safely

LOCKOUT_SCHEDULE = ((3, timedelta(minutes=30)), (4, timedelta(hours=1)), (5, timedelta(hours=24)))
LOCKOUT_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(hours=24)
SIGNUP_MESSAGE = "If the signup details can be accepted, verification instructions will be sent."
SIGNUP_RESERVATION_TTL = timedelta(minutes=30)
RESERVED_SUPERADMIN_EMAIL = "admin@friink.com"
RESERVED_SUPERADMIN_USERNAME_KEY = "admin"


def is_reserved_superadmin_email(email: str) -> bool:
    return email.strip().casefold() == RESERVED_SUPERADMIN_EMAIL


def build_user_from_signup(
    data: SignupRequest,
    *,
    is_staff: bool = False,
    setup_step: int = 1,
    setup_completed: bool = False,
) -> User:
    """Build a user using the same validated signup schema and invariants."""
    return User(
        email=str(data.email).strip().casefold(),
        username=data.username,
        username_key=data.username.casefold(),
        display_name=data.display_name or data.username,
        is_private=False,
        password_hash=hash_password(data.password),
        date_of_birth=data.date_of_birth,
        location=data.location,
        is_verified=True,
        is_staff=is_staff,
        setup_step=setup_step,
        setup_completed=setup_completed,
    )


async def get_user_by_email(session: Session, email: str) -> User | None:
    result = session.execute(select(User).where(func.lower(User.email) == email.strip().casefold()))
    return result.scalar_one_or_none()


async def get_user_by_username(session: Session, username: str) -> User | None:
    result = session.execute(select(User).where(User.username_key == username.casefold()))
    return result.scalar_one_or_none()


async def get_user_by_login_identifier(session: Session, identifier: str) -> User | None:
    normalized_identifier = identifier.strip()
    if normalized_identifier.startswith('@'):
        return await get_user_by_username(session, normalized_identifier[1:])
    if "@" in normalized_identifier:
        return await get_user_by_email(session, normalized_identifier)
    return await get_user_by_username(session, normalized_identifier)


async def is_username_available(session: Session, username: str, exclude_user_id: uuid.UUID | None = None) -> bool:
    existing_user = await get_user_by_username(session, username)
    if existing_user is not None and existing_user.id != exclude_user_id:
        return False
    return session.execute(select(ReservedUsername.id).where(ReservedUsername.username_key == username.casefold(), ReservedUsername.active.is_(True))).scalar_one_or_none() is None


async def create_user(session: Session, data: SignupRequest, email_service: EmailService | None = None) -> User:
    if is_reserved_superadmin_email(str(data.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    if await get_user_by_email(session, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    if not await is_username_available(session, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    user = build_user_from_signup(data)
    session.add(user)
    await commit(session)
    await refresh(session, user)
    session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="created"))
    session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="created"))
    await commit(session)

    if email_service:
        await email_service.send_registration_successful(user)
    return user


def _reservation_token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii")).digest()


async def start_signup_reservation(session: Session, data: SignupRequest, email_service: EmailService) -> str:
    normalized_email = str(data.email).strip().casefold()
    if is_reserved_superadmin_email(normalized_email):
        return secrets.token_urlsafe(32)
    # Check email first so an existing address never reveals whether its
    # submitted username is available or reserved.
    if await get_user_by_email(session, normalized_email):
        return secrets.token_urlsafe(32)
    if not await is_username_available(session, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    session.execute(delete(SignupReservation).where(SignupReservation.email == normalized_email))
    token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    reservation = SignupReservation(
        token_hash=_reservation_token_hash(token),
        email=normalized_email,
        username=data.username,
        username_key=data.username.casefold(),
        display_name=data.display_name or data.username,
        password_hash=hash_password(data.password),
        date_of_birth=data.date_of_birth,
        location=data.location,
        expires_at=now + SIGNUP_RESERVATION_TTL,
    )
    session.add(reservation)
    session.flush()
    otp_code = issue_signup_otp(session, reservation)
    await email_service.send_signup_otp(reservation.email, otp_code)
    await commit(session)
    return token


async def start_signup_email_reservation(session: Session, email: str, email_service: EmailService) -> str:
    normalized_email = email.strip().casefold()
    if is_reserved_superadmin_email(normalized_email):
        return secrets.token_urlsafe(32)
    session.execute(delete(SignupReservation).where(SignupReservation.email == normalized_email))
    token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    reservation = SignupReservation(
        token_hash=_reservation_token_hash(token),
        email=normalized_email,
        expires_at=now + SIGNUP_RESERVATION_TTL,
    )
    session.add(reservation)
    session.flush()
    otp_code = issue_signup_otp(session, reservation)
    await email_service.send_signup_otp(reservation.email, otp_code)
    await commit(session)
    return token


async def verify_signup_email_reservation(session: Session, token: str, otp: str) -> None:
    reservation = session.execute(
        select(SignupReservation).where(SignupReservation.token_hash == _reservation_token_hash(token))
    ).scalar_one_or_none()
    if not reservation or reservation.expires_at <= datetime.now(UTC) or reservation.email_verified_at is not None or not verify_signup_otp(session, reservation, otp):
        await commit(session)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")
    reservation.email_verified_at = datetime.now(UTC)
    await commit(session)


async def complete_signup_email_reservation(session: Session, token: str, data: SignupRequest) -> User:
    reservation = session.execute(
        select(SignupReservation).where(SignupReservation.token_hash == _reservation_token_hash(token))
    ).scalar_one_or_none()
    normalized_email = str(data.email).strip().casefold()
    if is_reserved_superadmin_email(normalized_email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The signup details could not be accepted.")
    if not reservation or reservation.expires_at <= datetime.now(UTC) or reservation.email_verified_at is None or normalized_email != reservation.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email verification is required before signup.")
    if await get_user_by_email(session, reservation.email) or not await is_username_available(session, data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The signup details could not be accepted.")

    user = User(
        email=reservation.email,
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
    session.delete(reservation)
    await commit(session)
    return user


async def complete_signup_reservation(session: Session, token: str, otp: str) -> User:
    reservation = session.execute(
        select(SignupReservation).where(SignupReservation.token_hash == _reservation_token_hash(token))
    ).scalar_one_or_none()
    if not reservation or reservation.expires_at <= datetime.now(UTC) or not verify_signup_otp(session, reservation, otp):
        await commit(session)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")

    if is_reserved_superadmin_email(reservation.email):
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


def purge_expired_signup_reservations(session: Session, now: datetime | None = None, batch_size: int = 500) -> int:
    """Bounded maintenance hook that releases abandoned signup emails."""
    now = now or datetime.now(UTC)
    ids = session.execute(
        select(SignupReservation.id).where(SignupReservation.expires_at <= now).limit(batch_size)
    ).scalars().all()
    if not ids:
        return 0
    result = session.execute(delete(SignupReservation).where(SignupReservation.id.in_(ids)))
    return result.rowcount or 0


async def update_current_user(session: Session, user: User, data: UpdateCurrentUserRequest) -> User:
    changed = False
    was_private = user.is_private

    if data.username is not None and data.username != user.username:
        if not await is_username_available(session, data.username, exclude_user_id=user.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")
        old_username = user.username
        user.username = data.username
        user.username_key = data.username.casefold()
        session.add(UserUsernameHistory(user_id=user.id, username_key=old_username.casefold(), username_display=old_username, event_type="released"))
        session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="changed"))
        changed = True

    if data.email is not None:
        normalized_email = str(data.email).strip().casefold()
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
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a password different from your current password.")

    user.password_hash = hash_password(data.new_password)
    await commit(session)


async def authenticate_user(
    session: Session,
    identifier: str,
    password: str,
    *,
    background_tasks: BackgroundTasks | None = None,
    settings=None,
) -> User:
    user = await get_user_by_login_identifier(session, identifier)
    now = datetime.now(UTC)

    if user and user.account_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Your account is locked. Contact support.",
        )

    if user and user.locked_until and user.locked_until > now:
        remaining = user.locked_until - now
        if remaining.total_seconds() <= 30 * 60 + 1:
            tier = "30 minutes"
        elif remaining.total_seconds() <= 60 * 60 + 1:
            tier = "1 hour"
        else:
            tier = "24 hours"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": f"Too many login attempts. Try again in about {tier}, around {user.locked_until.isoformat()} UTC.",
                "code": "LOGIN_COOLDOWN",
                "retry_at": user.locked_until.isoformat(),
            },
        )

    if not user or not verify_password(password, user.password_hash):
        if user:
            await register_failed_login(session, user, background_tasks=background_tasks, settings=settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    user.failed_login_attempts = 0
    user.locked_until = None
    await commit(session)
    await refresh(session, user)
    return user


async def register_failed_login(
    session: Session,
    user: User,
    *,
    background_tasks: BackgroundTasks | None = None,
    settings=None,
) -> None:
    user.failed_login_attempts += 1
    for threshold, duration in reversed(LOCKOUT_SCHEDULE):
        if user.failed_login_attempts >= threshold:
            user.locked_until = datetime.now(UTC) + duration
            break
    notification_needed = False
    if user.lifecycle_status == "active" and user.failed_login_attempts >= 3:
        cutoff = datetime.now(UTC) - timedelta(hours=24)
        recent = session.execute(
            select(SecurityEvent).where(
                SecurityEvent.user_id == user.id,
                SecurityEvent.event_type == SecurityEventType.failed_login,
                SecurityEvent.created_at >= cutoff,
                SecurityEvent.payload["kind"].as_string() == "failed_login_notification",
            )
        ).scalar_one_or_none()
        if recent is None:
            notification_needed = True
    await commit(session)
    record_security_event_safely(
        session,
        event_type=SecurityEventType.failed_login,
        event_key=f"failed-login:{user.id}:{uuid.uuid4()}",
        user_id=user.id,
        payload={"kind": "failed_login"},
    )
    if notification_needed:
        event = record_security_event_safely(
            session,
            event_type=SecurityEventType.failed_login,
            event_key=f"failed-login-notification:{user.id}:{uuid.uuid4()}",
            user_id=user.id,
            payload={"kind": "failed_login_notification"},
            notify_email=True,
        )
        if event is not None and background_tasks is not None and settings is not None:
            from app.services.failed_login_notifications import deliver_failed_login_alert
            background_tasks.add_task(deliver_failed_login_alert, event.id, settings)


def user_id_from_subject(subject: str) -> uuid.UUID:
    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_error_detail("Invalid token.", AuthErrorCode.TOKEN_SCHEMA_INVALID),
        ) from exc
