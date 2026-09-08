import uuid
from datetime import UTC, datetime, timedelta
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import Session
from app.db import Base
from app.models.user import User
from app.models.staff import StaffPermission, StaffRole, UserPermissionGrant, PrivilegedStaffSession, user_roles
from app.services.security import hash_password
from app.services.staff import permissions_for, require_privileged
import pytest
from fastapi import HTTPException

def make_session():
    engine = create_engine(f"sqlite+pysqlite:///./.phase5-{uuid.uuid4().hex}.sqlite3")
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _record):
        connection.create_function("char_length", 1, len)
    Base.metadata.create_all(engine)
    return engine, Session(engine)

def test_effective_permissions_union_roles_and_direct_grant():
    engine, session = make_session()
    try:
        user = User(public_id="public-test", email=f"p5-{uuid.uuid4().hex}@example.com", username="p5user", username_key="p5user", password_hash=hash_password("Valid1!x"), date_of_birth=datetime(1990,1,1).date(), is_staff=True)
        first = StaffPermission(key="users.view", display_name="View"); second = StaffPermission(key="audit.view", display_name="Audit")
        role = StaffRole(key="support", display_name="Support", permissions=[first]); session.add_all([user, first, second, role]); session.flush(); session.execute(user_roles.insert().values(user_id=user.id, role_id=role.id)); session.add(UserPermissionGrant(user_id=user.id, permission_id=second.id)); session.commit()
        assert permissions_for(session, user) == {"users.view", "audit.view"}
    finally: session.close(); engine.dispose()

def test_privileged_session_expiry_denies_without_affecting_user():
    engine, session = make_session()
    try:
        user = User(public_id="public-test", email=f"p5-{uuid.uuid4().hex}@example.com", username="p5user", username_key="p5user", password_hash=hash_password("Valid1!x"), date_of_birth=datetime(1990,1,1).date(), is_staff=True)
        permission = StaffPermission(key="staff.access", display_name="Access"); role = StaffRole(key="support", display_name="Support", permissions=[permission]); session.add_all([user, permission, role]); session.flush(); session.execute(user_roles.insert().values(user_id=user.id, role_id=role.id)); token="opaque-test-token"; session.add(PrivilegedStaffSession(user_id=user.id, token_hash=PrivilegedStaffSession.hash_token(token), expires_at=datetime.now(UTC)-timedelta(seconds=1))); session.commit()
        with pytest.raises(HTTPException) as error: require_privileged(session, user, token, "staff.access")
        assert error.value.status_code == 401 and user.is_staff is True
    finally: session.close(); engine.dispose()
