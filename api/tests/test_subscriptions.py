from datetime import UTC, datetime, timedelta
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import sessionmaker
from app.db import Base

from app.models.security_event import SecurityEvent
from app.models.staff import PrivilegedStaffSession, StaffPermission, StaffRole, user_roles
from app.models.subscription import Plan, SubscriptionAssignment
from app.models.user import User
from app.services.security import hash_password
from app.services.subscriptions import effective_plan, effective_status, grant, has_entitlement, revoke
from app.services.staff import require_superadmin
from fastapi import HTTPException


@pytest.fixture
def session():
    path = Path.cwd() / f".subscription-test-{uuid.uuid4().hex}.sqlite3"
    engine = create_engine(f"sqlite+pysqlite:///{path}")
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _record):
        connection.create_function("char_length", 1, len)
    Base.metadata.create_all(engine)
    with sessionmaker(engine)() as db:
        yield db
    engine.dispose()
    path.unlink(missing_ok=True)


def make_user(username: str, *, staff: bool = False) -> User:
    return User(public_id=f"public-{username}", email=f"{username}-{uuid.uuid4().hex}@example.com", username=username, username_key=username, password_hash=hash_password("Valid1!x"), date_of_birth=datetime(1990, 1, 1).date(), is_staff=staff)


def setup(session):
    free = Plan(code="friink_free", name="Friink Free", description="Core")
    pro = Plan(code="friink_pro", name="Friink Pro", description="Pro")
    plus = Plan(code="friink_pro_plus", name="Friink Pro+", description="Plus")
    from app.models.subscription import PlanEntitlement
    pro.entitlements.append(PlanEntitlement(entitlement_key="message_requests"))
    plus.entitlements.append(PlanEntitlement(entitlement_key="message_requests"))
    session.add_all([free, pro, plus]); session.flush()
    admin = make_user("admin", staff=True); user = make_user("subscriber")
    role = StaffRole(key=f"superadmin_{uuid.uuid4().hex[:8]}", display_name=f"Superadmin {uuid.uuid4().hex[:8]}")
    # The service boundary recognizes the established system role key.
    role.key = "superadmin"; role.permissions = [StaffPermission(key="roles.manage", display_name="Manage roles")]
    session.add_all([admin, user, role]); session.flush(); session.execute(user_roles.insert().values(user_id=admin.id, role_id=role.id))
    token = "staff-token"; session.add(PrivilegedStaffSession(user_id=admin.id, token_hash=PrivilegedStaffSession.hash_token(token), expires_at=datetime.now(UTC) + timedelta(hours=1))); session.commit()
    return admin, user, token


def test_subscription_lifecycle_and_deterministic_expiry(session, monkeypatch):
    admin, user, _ = setup(session)
    clock = datetime(2030, 1, 1, tzinfo=UTC); monkeypatch.setattr("app.services.subscriptions.utc_now", lambda: clock)
    assignment = grant(session, admin, user, "friink_pro", 2, "founding access")
    assert effective_plan(user, session).code == "friink_pro"
    assert has_entitlement(user, "message_requests", session)
    monkeypatch.setattr("app.services.subscriptions.utc_now", lambda: clock + timedelta(days=2))
    assert effective_plan(user, session).code == "friink_free"
    assert not has_entitlement(user, "message_requests", session)
    assert effective_status(assignment) == "expired"


def test_indefinite_revocation_replacement_and_audit(session, monkeypatch):
    admin, user, _ = setup(session)
    clock = datetime(2030, 1, 1, tzinfo=UTC); monkeypatch.setattr("app.services.subscriptions.utc_now", lambda: clock)
    first = grant(session, admin, user, "friink_pro", None, "pro")
    second = grant(session, admin, user, "friink_pro_plus", None, "plus")
    assert first.status == "revoked" and effective_plan(user, session).code == "friink_pro_plus"
    revoke(session, admin, user, "manual removal")
    assert effective_plan(user, session).code == "friink_free"
    kinds = [event.payload["kind"] for event in session.execute(select(SecurityEvent).where(SecurityEvent.user_id == admin.id)).scalars()]
    assert kinds.count("subscription_granted") == 2
    assert "subscription_replaced" in kinds and "subscription_revoked" in kinds


def test_free_fallback_and_unauthorized_staff_boundary(session):
    admin, user, _ = setup(session)
    assert effective_plan(user, session).code == "friink_free"
    staff = make_user("support", staff=True)
    session.add(staff); session.flush()
    staff_session = PrivilegedStaffSession(user_id=staff.id, token_hash=PrivilegedStaffSession.hash_token("support-token"), expires_at=datetime.now(UTC) + timedelta(hours=1))
    session.add(staff_session); session.commit()
    with pytest.raises(HTTPException) as error:
        require_superadmin(session, staff, "support-token")
    assert error.value.status_code == 403


def test_invalid_duration_and_client_expiry_are_rejected():
    from app.schemas.subscriptions import SubscriptionGrantRequest
    with pytest.raises(ValueError): SubscriptionGrantRequest(plan_code="friink_pro", duration_days=-1, reason="x")
    with pytest.raises(ValueError): SubscriptionGrantRequest(plan_code="friink_pro", reason="x", expires_at="2030-01-01")
