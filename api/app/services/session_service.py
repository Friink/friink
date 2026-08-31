from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import secrets
import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.refresh_token import RefreshToken
from app.models.auth_session import AuthSession

DEAD_TOKEN_RETENTION = timedelta(days=30)


@dataclass(frozen=True)
class IssuedRefreshToken:
    raw_token: str
    record: RefreshToken


def hash_refresh_token(raw_token: str) -> bytes:
    return hashlib.sha256(raw_token.encode("utf-8")).digest()


def issue_refresh_token(session: Session, user_id: uuid.UUID, settings: Settings, family_id: uuid.UUID | None = None, session_id: uuid.UUID | None = None) -> IssuedRefreshToken:
    raw_token = secrets.token_urlsafe(32)
    record = RefreshToken(
        user_id=user_id,
        session_id=session_id,
        family_id=family_id or uuid.uuid4(),
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
    )
    session.add(record)
    session.flush()
    return IssuedRefreshToken(raw_token=raw_token, record=record)


def get_refresh_token_for_update(session: Session, raw_token: str) -> RefreshToken | None:
    return session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token)).with_for_update()
    ).scalar_one_or_none()


def get_refresh_token(session: Session, raw_token: str) -> RefreshToken | None:
    return session.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))).scalar_one_or_none()


def create_auth_session(session: Session, user_id: uuid.UUID, request) -> AuthSession:
    user_agent = request.headers.get("user-agent") or ""
    try:
        from user_agents import parse

        parsed = parse(user_agent)
        device = parsed.device.family if parsed.device.family and parsed.device.family.lower() != "other" else "Unknown device"
        browser = parsed.browser.family if parsed.browser.family and parsed.browser.family.lower() != "other" else None
        operating_system = parsed.os.family if parsed.os.family and parsed.os.family.lower() != "other" else None
    except Exception:
        device = "Unknown device"
        browser = None
        operating_system = None
    auth_session = AuthSession(
        user_id=user_id,
        device_label=device,
        browser=browser,
        operating_system=operating_system,
        user_agent=user_agent[:512] or None,
    )
    session.add(auth_session)
    session.flush()
    return auth_session


def list_active_auth_sessions(session: Session, user_id: uuid.UUID) -> list[AuthSession]:
    return list(session.execute(select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)).order_by(AuthSession.last_active_at.desc())).scalars().all())


def revoke_auth_session(session: Session, auth_session: AuthSession, reason: str = "logout") -> None:
    now = datetime.now(UTC)
    auth_session.revoked_at = now
    auth_session.revoke_reason = reason
    revoke_refresh_family_for_session(session, auth_session.id, reason, now)


def revoke_refresh_family_for_session(session: Session, session_id: uuid.UUID, reason: str, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    result = session.execute(update(RefreshToken).where(RefreshToken.session_id == session_id, RefreshToken.revoked_at.is_(None)).values(revoked_at=now, revocation_reason=reason))
    return result.rowcount or 0


def revoke_refresh_family(session: Session, family_id: uuid.UUID, reason: str, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    result = session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now, revocation_reason=reason)
    )
    return result.rowcount or 0


def revoke_refresh_token(session: Session, record: RefreshToken, reason: str, now: datetime | None = None) -> None:
    record.revoked_at = now or datetime.now(UTC)
    record.revocation_reason = reason


def purge_expired_refresh_tokens(session: Session, now: datetime | None = None, batch_size: int = 500) -> int:
    """Bounded cleanup hook for a future scheduled maintenance command."""
    now = now or datetime.now(UTC)
    cutoff = now - DEAD_TOKEN_RETENTION
    ids = session.execute(
        select(RefreshToken.id).where(RefreshToken.expires_at < cutoff).limit(batch_size)
    ).scalars().all()
    if not ids:
        return 0
    result = session.execute(delete(RefreshToken).where(RefreshToken.id.in_(ids)))
    return result.rowcount or 0
