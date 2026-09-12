import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.account_session_slot import AccountSessionSlot
from app.models.auth_session import AuthSession
from app.models.user import User
from app.services.session_service import revoke_auth_session


def hash_slot(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def device_hash(raw_device: str | None) -> bytes | None:
    return hash_slot(raw_device) if raw_device else None


def create_or_replace_slot(
    session: Session,
    user: User,
    raw_device: str | None,
    auth_session: AuthSession,
    settings: Settings,
    *,
    allow_over_limit: bool = False,
) -> str | None:
    if not raw_device:
        return None
    current_device_hash = device_hash(raw_device)
    existing = session.execute(select(AccountSessionSlot).where(AccountSessionSlot.user_id == user.id, AccountSessionSlot.device_hash == current_device_hash, AccountSessionSlot.revoked_at.is_(None))).scalars().all()
    slot = existing[0] if existing else None
    if slot:
        old_session = session.get(AuthSession, slot.auth_session_id)
        if old_session and old_session.id != auth_session.id:
            revoke_auth_session(session, old_session, "replaced_device_slot")
        slot.auth_session_id = auth_session.id
        slot.last_used_at = datetime.now(UTC)
        raw_slot = str(slot.id)
        return raw_slot
    device_slots = session.execute(select(AccountSessionSlot).where(AccountSessionSlot.device_hash == current_device_hash, AccountSessionSlot.revoked_at.is_(None))).scalars().all()
    if len(device_slots) >= settings.max_remembered_accounts_per_device:
        if allow_over_limit:
            return None
        raise ValueError("ACCOUNT_LIMIT_REACHED")
    raw_slot = secrets.token_urlsafe(32)
    slot = AccountSessionSlot(user_id=user.id, device_hash=current_device_hash, slot_token_hash=hash_slot(raw_slot), auth_session_id=auth_session.id)
    session.add(slot)
    session.flush()
    return str(slot.id)


def find_slot_for_user(session: Session, user_id: uuid.UUID, raw_device: str | None) -> AccountSessionSlot | None:
    if not raw_device:
        return None
    return session.execute(
        select(AccountSessionSlot).where(
            AccountSessionSlot.user_id == user_id,
            AccountSessionSlot.device_hash == hash_slot(raw_device),
            AccountSessionSlot.revoked_at.is_(None),
        )
    ).scalars().first()


def get_slot(session: Session, raw_slot: str, raw_device: str | None) -> AccountSessionSlot | None:
    if not raw_device:
        return None
    try:
        slot_id = uuid.UUID(raw_slot)
    except ValueError:
        return None
    return session.execute(select(AccountSessionSlot).where(AccountSessionSlot.id == slot_id, AccountSessionSlot.device_hash == hash_slot(raw_device), AccountSessionSlot.revoked_at.is_(None))).scalar_one_or_none()


def list_slots(session: Session, raw_device: str | None) -> list[tuple[AccountSessionSlot, User]]:
    if not raw_device:
        return []
    rows = session.execute(
        select(AccountSessionSlot, User)
        .join(User, User.id == AccountSessionSlot.user_id)
        .join(AuthSession, AuthSession.id == AccountSessionSlot.auth_session_id)
        .where(
            AccountSessionSlot.device_hash == hash_slot(raw_device),
            AccountSessionSlot.revoked_at.is_(None),
            AuthSession.revoked_at.is_(None),
            User.lifecycle_status == "active",
        )
        .order_by(AccountSessionSlot.last_used_at.desc())
    ).all()
    return list(rows)


def revoke_slot(session: Session, slot: AccountSessionSlot) -> None:
    slot.revoked_at = datetime.now(UTC)
    auth_session = session.get(AuthSession, slot.auth_session_id)
    if auth_session:
        revoke_auth_session(session, auth_session, "account_removed_from_device")


def raw_slot_for_hash(value: bytes) -> str | None:
    # Slot IDs are the public opaque capability; this helper is retained only
    # for compatibility with callers that may have imported it.
    return None
