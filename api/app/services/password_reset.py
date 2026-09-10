import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.password_reset import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.account_session_slot import AccountSessionSlot
from app.models.user import User
from app.services.auth import get_user_by_email
from app.services.security import hash_password, verify_password
from app.services.session_service import revoke_refresh_family
from app.services.session_ops import commit
from app.services.staff import revoke_staff_sessions

RESET_TTL = timedelta(minutes=30)


def _hash(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


async def start_password_reset(session: Session, email: str, *, purpose: str = "ordinary") -> tuple[User | None, str | None]:
    user = await get_user_by_email(session, email)
    if not user or user.lifecycle_status == "deleted":
        return None, None
    now = datetime.now(UTC)
    session.execute(update(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.consumed_at.is_(None)).values(consumed_at=now))
    raw = secrets.token_urlsafe(48)
    session.add(PasswordResetToken(user_id=user.id, token_hash=_hash(raw), purpose=purpose, expires_at=now + RESET_TTL))
    await commit(session)
    return user, raw


async def complete_password_reset(session: Session, token: str, new_password: str) -> None:
    record = session.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash(token), PasswordResetToken.consumed_at.is_(None))).scalar_one_or_none()
    now = datetime.now(UTC)
    if not record or record.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This password reset link is invalid or expired.")
    user = session.get(User, record.user_id)
    if not user or user.lifecycle_status == "deleted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This password reset link is invalid or expired.")
    if record.purpose == "suspicious_login" and verify_password(new_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a password different from your current password.")
    record.consumed_at = now
    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.failed_login_last_at = None
    user.locked_until = None
    for family in session.execute(select(RefreshToken.family_id).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))).scalars().all():
        revoke_refresh_family(session, family, "password_reset", now)
    revoke_staff_sessions(session, user.id, "password_reset")
    session.execute(update(AccountSessionSlot).where(AccountSessionSlot.user_id == user.id, AccountSessionSlot.revoked_at.is_(None)).values(revoked_at=now))
    await commit(session)
