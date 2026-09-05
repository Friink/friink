from datetime import UTC, datetime, timedelta
import hashlib
import secrets

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.email_change import EmailChangeRequest
from app.models.user import User
from app.services.email import EmailService
from app.services.otp import issue_email_change_otp, verify_email_change_otp
from app.services.session_ops import commit, refresh
from app.services.auth import get_user_by_email
from app.services.security import verify_password
from app.models.identity_history import UserEmailHistory

EMAIL_CHANGE_TTL = timedelta(minutes=4)


def _hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii")).digest()


async def start_email_change(
    session: Session, user: User, new_email: str, current_password: str, email_service: EmailService
) -> tuple[str, str]:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    normalized_email = new_email.strip().casefold()
    if normalized_email == user.email.casefold():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a different email address.")
    existing = await get_user_by_email(session, normalized_email)
    if existing and existing.id != user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    now = datetime.now(UTC)
    session.execute(
        update(EmailChangeRequest)
        .where(EmailChangeRequest.user_id == user.id, EmailChangeRequest.consumed_at.is_(None))
        .values(consumed_at=now)
    )
    raw_token = secrets.token_urlsafe(32)
    request = EmailChangeRequest(
        token_hash=_hash_token(raw_token),
        user_id=user.id,
        new_email=normalized_email,
        expires_at=now + EMAIL_CHANGE_TTL,
    )
    session.add(request)
    session.flush()
    code = issue_email_change_otp(session, user, request.id)
    await email_service.send_email_change_otp(normalized_email, code)
    await commit(session)
    return raw_token, "A verification code was sent to your new email address."


async def complete_email_change(session: Session, user: User, raw_token: str, code: str) -> User:
    request = session.execute(
        select(EmailChangeRequest)
        .where(EmailChangeRequest.token_hash == _hash_token(raw_token), EmailChangeRequest.user_id == user.id)
        .with_for_update()
    ).scalar_one_or_none()
    if (
        not request
        or request.consumed_at is not None
        or request.expires_at <= datetime.now(UTC)
        or not verify_email_change_otp(session, user, request.id, code)
    ):
        await commit(session)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The verification code is invalid or expired.")

    existing = await get_user_by_email(session, request.new_email)
    if existing and existing.id != user.id:
        request.consumed_at = datetime.now(UTC)
        await commit(session)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    old_email = user.email
    user.email = request.new_email
    request.consumed_at = datetime.now(UTC)
    session.add(UserEmailHistory(user_id=user.id, email_value=old_email, event_type="replaced"))
    session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="changed"))
    await commit(session)
    await refresh(session, user)
    return user
