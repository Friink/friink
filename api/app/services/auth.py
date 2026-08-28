from datetime import UTC, datetime, timedelta
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import SignupRequest, UpdateCurrentUserRequest
from app.services.email import EmailService
from app.services.security import hash_password, verify_password

LOCKOUT_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(hours=3)


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_user(session: AsyncSession, data: SignupRequest, email_service: EmailService | None = None) -> User:
    if await get_user_by_email(session, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    if await get_user_by_username(session, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    user = User(
        email=data.email.lower(),
        username=data.username,
        display_name=data.display_name or data.username,
        password_hash=hash_password(data.password),
        date_of_birth=data.date_of_birth,
        location=data.location,
        is_verified=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # TODO: once OTP verification is reintroduced, keep incomplete registrations
    # reusable by cleaning up or expiring unverified rows before uniqueness checks.
    # TODO: wire up OTP once email is configured.
    if email_service:
        await email_service.send_registration_successful(user)
    return user


async def update_current_user(session: AsyncSession, user: User, data: UpdateCurrentUserRequest) -> User:
    changed = False

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

    if not changed:
        return user

    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
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
    await session.commit()
    await session.refresh(user)
    # TODO: insert OTP challenge here between password check and token issuance, once email is configured.
    return user


async def register_failed_login(session: AsyncSession, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= LOCKOUT_ATTEMPTS:
        user.locked_until = datetime.now(UTC) + LOCKOUT_DURATION
        user.failed_login_attempts = 0
    await session.commit()


def user_id_from_subject(subject: str) -> uuid.UUID:
    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc
