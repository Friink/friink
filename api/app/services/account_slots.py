import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.auth_session import AuthSession
from app.models.recognized_device import RecognizedDevice
from app.models.user import User
from app.services.session_service import revoke_auth_session


def hash_slot(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def device_hash(raw_device: str | None) -> bytes | None:
    return hash_slot(raw_device) if raw_device else None


@dataclass
class AccountSlot:
    """Transient account-switcher view backed by an existing auth session."""

    auth_session: AuthSession

    @property
    def id(self) -> uuid.UUID:
        return self.auth_session.id

    @property
    def user_id(self) -> uuid.UUID:
        return self.auth_session.user_id

    @property
    def auth_session_id(self) -> uuid.UUID:
        return self.auth_session.id

    @property
    def last_used_at(self) -> datetime:
        return self.auth_session.last_active_at

    @last_used_at.setter
    def last_used_at(self, value: datetime) -> None:
        self.auth_session.last_active_at = value

    @property
    def revoked_at(self) -> datetime | None:
        return self.auth_session.revoked_at


def _device_ids(session: Session, raw_device: str | None) -> list[uuid.UUID]:
    if not raw_device:
        return []
    return list(
        session.execute(
            select(RecognizedDevice.id).where(
                RecognizedDevice.token_hash == device_hash(raw_device),
            )
        ).scalars()
    )


def create_or_replace_slot(
    session: Session,
    user: User,
    raw_device: str | None,
    auth_session: AuthSession,
    settings: Settings,
    *,
    allow_over_limit: bool = False,
) -> str | None:
    del allow_over_limit  # Slot-only authentication never creates an un-slotted session.
    device_ids = _device_ids(session, raw_device)
    if not device_ids:
        return None

    existing_sessions = list(
        session.execute(
            select(AuthSession).where(
                AuthSession.user_id == user.id,
                AuthSession.device_id.in_(device_ids),
                AuthSession.revoked_at.is_(None),
                AuthSession.id != auth_session.id,
            )
        ).scalars()
    )
    if existing_sessions:
        for existing in existing_sessions:
            if existing.id != auth_session.id:
                revoke_auth_session(session, existing, "replaced_device_slot")
        return str(auth_session.id)

    active_device_sessions = list(
        session.execute(
            select(AuthSession)
            .join(User, User.id == AuthSession.user_id)
            .where(
                AuthSession.device_id.in_(device_ids),
                AuthSession.revoked_at.is_(None),
                AuthSession.id != auth_session.id,
                User.lifecycle_status == "active",
            )
        ).scalars()
    )
    if len(active_device_sessions) >= settings.max_remembered_accounts_per_device:
        raise ValueError("ACCOUNT_LIMIT_REACHED")
    return str(auth_session.id)


def find_slot_for_user(session: Session, user_id: uuid.UUID, raw_device: str | None) -> AccountSlot | None:
    device_ids = _device_ids(session, raw_device)
    if not device_ids:
        return None
    auth_session = session.execute(
        select(AuthSession).where(
            AuthSession.user_id == user_id,
            AuthSession.device_id.in_(device_ids),
            AuthSession.revoked_at.is_(None),
        ).order_by(AuthSession.last_active_at.desc())
    ).scalars().first()
    return AccountSlot(auth_session) if auth_session else None


def get_slot(session: Session, raw_slot: str, raw_device: str | None) -> AccountSlot | None:
    device_ids = _device_ids(session, raw_device)
    if not device_ids:
        return None
    try:
        session_id = uuid.UUID(raw_slot)
    except (TypeError, ValueError):
        return None
    auth_session = session.execute(
        select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.device_id.in_(device_ids),
            AuthSession.revoked_at.is_(None),
        )
    ).scalar_one_or_none()
    return AccountSlot(auth_session) if auth_session else None


def list_slots(session: Session, raw_device: str | None) -> list[tuple[AccountSlot, User]]:
    device_ids = _device_ids(session, raw_device)
    if not device_ids:
        return []
    rows = session.execute(
        select(AuthSession, User)
        .join(User, User.id == AuthSession.user_id)
        .where(
            AuthSession.device_id.in_(device_ids),
            AuthSession.revoked_at.is_(None),
            User.lifecycle_status == "active",
        )
        .order_by(AuthSession.last_active_at.desc())
    ).all()
    return [(AccountSlot(auth_session), user) for auth_session, user in rows]


def revoke_slot(session: Session, slot: AccountSlot, reason: str = "account_removed_from_device") -> None:
    auth_session = session.get(AuthSession, slot.auth_session_id)
    if auth_session:
        revoke_auth_session(session, auth_session, reason)


def raw_slot_for_hash(value: bytes) -> str | None:
    del value
    return None
