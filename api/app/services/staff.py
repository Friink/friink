from datetime import UTC, datetime, timedelta
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.staff import StaffPermission, StaffRole, UserPermissionGrant, PrivilegedStaffSession, user_roles
from app.models.user import User
from app.models.security_event import SecurityEvent, SecurityEventType
PERMISSIONS = {"staff.access", "users.view", "users.lock", "users.unlock", "sessions.revoke", "roles.manage", "audit.view"}
IDLE = timedelta(minutes=16)
ABSOLUTE = timedelta(hours=8)

def permissions_for(session: Session, user: User) -> set[str]:
    if not user.is_staff: return set()
    keys = session.execute(select(StaffRole.key).join(user_roles, user_roles.c.role_id == StaffRole.id).where(user_roles.c.user_id == user.id)).scalars().all()
    if "superadmin" in keys: return set(PERMISSIONS)
    inherited = session.execute(select(StaffPermission.key).join(StaffRole.permissions).join(user_roles, user_roles.c.role_id == StaffRole.id).where(user_roles.c.user_id == user.id)).scalars().all()
    direct = session.execute(select(StaffPermission.key).join(UserPermissionGrant, UserPermissionGrant.permission_id == StaffPermission.id).where(UserPermissionGrant.user_id == user.id)).scalars().all()
    return set(inherited) | set(direct)

def require_staff(session: Session, user: User, permission: str) -> None:
    if permission not in permissions_for(session, user): raise HTTPException(status_code=403, detail="You are not authorized to perform this action.")

def require_superadmin(session: Session, user: User, token: str | None) -> PrivilegedStaffSession:
    privileged = require_privileged(session, user, token, "roles.manage")
    is_superadmin = session.execute(select(StaffRole.id).join(user_roles, user_roles.c.role_id == StaffRole.id).where(user_roles.c.user_id == user.id, StaffRole.key == "superadmin")).scalar_one_or_none()
    if is_superadmin is None:
        raise HTTPException(status_code=403, detail="Only superadmins may manage subscriptions.")
    return privileged

def require_privileged(session: Session, user: User, token: str | None, permission: str) -> PrivilegedStaffSession:
    now = datetime.now(UTC)
    row = session.execute(select(PrivilegedStaffSession).where(PrivilegedStaffSession.token_hash == PrivilegedStaffSession.hash_token(token or ""), PrivilegedStaffSession.user_id == user.id, PrivilegedStaffSession.revoked_at.is_(None))).scalar_one_or_none()
    if not row or row.expires_at <= now or row.last_active_at + IDLE <= now or not user.is_staff:
        if row and row.revoked_at is None: row.revoked_at, row.revoke_reason = now, "expired"
        raise HTTPException(status_code=401, detail="Staff session expired. Please verify again.")
    row.last_active_at = now; require_staff(session, user, permission); return row

def audit(session: Session, actor: User, kind: str, payload: dict, privileged: PrivilegedStaffSession | None = None) -> None:
    session.add(SecurityEvent(event_type=SecurityEventType.staff_mutation, event_key=f"staff:{kind}:{uuid.uuid4()}", user_id=actor.id, payload={"kind": kind, "actor": actor.public_id, **payload, "privileged_session": str(privileged.id) if privileged else None}))

def start_privileged(session: Session, user: User, password: str) -> tuple[str, PrivilegedStaffSession]:
    from app.services.security import verify_password
    if not user.is_staff or user.account_locked or not verify_password(password, user.password_hash): raise HTTPException(status_code=401, detail="Unable to verify staff access.")
    token = PrivilegedStaffSession.new_token(); now = datetime.now(UTC)
    row = PrivilegedStaffSession(user_id=user.id, token_hash=PrivilegedStaffSession.hash_token(token), expires_at=now + ABSOLUTE); session.add(row); audit(session, user, "privileged_session_started", {"result": "success"}, row); session.commit(); return token, row

def revoke_staff_sessions(session: Session, user_id: uuid.UUID, reason: str) -> int:
    rows = session.execute(select(PrivilegedStaffSession).where(PrivilegedStaffSession.user_id == user_id, PrivilegedStaffSession.revoked_at.is_(None))).scalars().all(); now = datetime.now(UTC)
    for row in rows: row.revoked_at, row.revoke_reason = now, reason
    return len(rows)

def effective_role_payload(role: StaffRole) -> dict:
    return {"key": role.key, "display_name": role.display_name, "system": role.is_system, "permissions": sorted(p.key for p in role.permissions)}
