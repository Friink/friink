from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models.auth_session import AuthSession
from app.models.refresh_token import RefreshToken
from app.models.recognized_device import RecognizedDevice
from app.models.security_event import SecurityEvent
from app.models.staff import PrivilegedStaffSession
from app.models.user import User
from app.routers.auth_operations import contain_compromised_admin, revoke_user_sessions
from app.schemas.auth_operations import AuthOperationRequest
from app.services.security import hash_password


def make_session() -> tuple[object, Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _record):
        connection.create_function("char_length", 1, len)

    Base.metadata.create_all(engine)
    return engine, Session(engine)


def make_user(session: Session, *, is_staff: bool = False) -> User:
    user = User(
        public_id="phase6-test-user",
        email="phase6@example.com",
        username="phase6user",
        username_key="phase6user",
        password_hash=hash_password("Valid1!x"),
        date_of_birth=datetime(1990, 1, 1).date(),
        is_staff=is_staff,
    )
    session.add(user)
    session.flush()
    return user


def test_per_user_revoke_is_idempotent_and_revokes_active_records() -> None:
    engine, session = make_session()
    try:
        user = make_user(session)
        device = RecognizedDevice(user_id=user.id, token_hash=b"device-hash")
        session.add(device)
        session.flush()
        auth_session = AuthSession(user_id=user.id, device_id=device.id)
        session.add(auth_session)
        session.flush()
        session.add(
            RefreshToken(
                user_id=user.id,
                session_id=auth_session.id,
                family_id=auth_session.id,
                token_hash=b"refresh-hash",
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        session.commit()

        payload = AuthOperationRequest(reason="phase 6 rehearsal")
        first = revoke_user_sessions(user.id, payload, session, "rehearsal-key", None)
        second = revoke_user_sessions(user.id, payload, session, "rehearsal-key", None)

        assert first == second
        assert first["counts"] == {"sessions": 1, "refresh_tokens": 1, "devices": 1}
        assert session.get(User, user.id).security_epoch == 1
        assert session.execute(select(AuthSession).where(AuthSession.id == auth_session.id)).scalar_one().revoke_reason == "security_incident"
        assert session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id)).scalar_one().revocation_reason == "security_incident"
        assert session.execute(select(RecognizedDevice).where(RecognizedDevice.id == device.id)).scalar_one().revoked_at is not None
        assert len(session.execute(select(SecurityEvent)).scalars().all()) == 1
    finally:
        session.close()
        engine.dispose()


def test_compromised_admin_containment_disables_staff_and_privileged_sessions() -> None:
    engine, session = make_session()
    try:
        user = make_user(session, is_staff=True)
        session.add(
            PrivilegedStaffSession(
                user_id=user.id,
                token_hash="privileged-hash",
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        session.commit()

        result = contain_compromised_admin(user.id, AuthOperationRequest(reason="suspected admin compromise"), session, "containment-key", None)

        refreshed_user = session.get(User, user.id)
        assert result["status"] == "contained"
        assert result["counts"]["privileged_sessions"] == 1
        assert refreshed_user.is_staff is False
        assert refreshed_user.account_locked is True
        assert refreshed_user.security_epoch == 1
        privileged = session.execute(select(PrivilegedStaffSession).where(PrivilegedStaffSession.user_id == user.id)).scalar_one()
        assert privileged.revoke_reason == "security_incident"
    finally:
        session.close()
        engine.dispose()
