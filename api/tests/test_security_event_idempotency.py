import uuid

from sqlalchemy import func, select

from app.models.security_event import SecurityEvent, SecurityEventType
from app.services.security_events import record_security_event


def test_deterministic_security_event_keys_are_idempotent() -> None:
    from app.db import get_session_factory

    cases = (
        (SecurityEventType.refresh_reuse_detected, f"refresh-reuse:{uuid.uuid4()}"),
        (SecurityEventType.fresh_login, f"fresh-login:{uuid.uuid4()}"),
        (SecurityEventType.bootstrap_succeeded, f"bootstrap-succeeded:{uuid.uuid4()}"),
    )
    with get_session_factory()() as session:
        for event_type, event_key in cases:
            first = record_security_event(session, event_type=event_type, event_key=event_key, idempotent=True)
            second = record_security_event(session, event_type=event_type, event_key=event_key, idempotent=True)
            assert second.id == first.id
        session.commit()
        assert session.execute(select(func.count()).select_from(SecurityEvent)).scalar_one() == len(cases)


def test_duplicate_security_event_returns_existing_event_object() -> None:
    from app.db import get_session_factory

    event_key = f"refresh-reuse:{uuid.uuid4()}"
    with get_session_factory()() as session:
        first = record_security_event(
            session,
            event_type=SecurityEventType.refresh_reuse_detected,
            event_key=event_key,
            idempotent=True,
        )
        duplicate = record_security_event(
            session,
            event_type=SecurityEventType.refresh_reuse_detected,
            event_key=event_key,
            notify_in_app=True,
            idempotent=True,
        )

        assert duplicate.id == first.id
        assert duplicate.event_key == event_key
        assert duplicate is session.get(SecurityEvent, first.id)


def test_new_security_event_key_still_inserts_normally() -> None:
    from app.db import get_session_factory

    with get_session_factory()() as session:
        first = record_security_event(
            session,
            event_type=SecurityEventType.refresh_reuse_detected,
            event_key=f"refresh-reuse:{uuid.uuid4()}",
            idempotent=True,
        )
        second = record_security_event(
            session,
            event_type=SecurityEventType.refresh_reuse_detected,
            event_key=f"refresh-reuse:{uuid.uuid4()}",
            idempotent=True,
        )
        session.commit()
        assert first.id != second.id
