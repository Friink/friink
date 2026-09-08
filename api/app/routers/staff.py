from datetime import UTC, datetime
from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_session
from app.models.user import User
from app.models.staff import StaffPermission, StaffRole, PrivilegedStaffSession, user_roles
from app.models.auth_session import AuthSession
from app.models.security_event import SecurityEvent
from app.routers.auth import get_current_user
from app.schemas.staff import StepUpRequest, RoleCreate, RoleUpdate, AssignmentRequest, ReasonRequest, GrantRequest, StaffStatusRequest, StaffMe, RoleResponse, StaffUserResponse, AuditResponse
from app.services.staff import permissions_for, require_privileged, audit, start_privileged, revoke_staff_sessions, effective_role_payload, PERMISSIONS

router = APIRouter(prefix="/staff", tags=["staff"]); STAFF_COOKIE = "friink_staff_session"
def target(session, public_id):
    user = session.execute(select(User).where(User.public_id == public_id)).scalar_one_or_none()
    if not user: from fastapi import HTTPException; raise HTTPException(404, "User not found.")
    return user

@router.post("/step-up", response_model=StaffMe)
async def step_up(payload: StepUpRequest, response: Response, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    token, row = start_privileged(session, current_user, payload.password); response.set_cookie(STAFF_COOKIE, token, httponly=True, secure=True, samesite="none", max_age=28800, path="/"); return StaffMe(permissions=sorted(permissions_for(session, current_user)), privileged_expires_at=row.expires_at)

@router.post("/logout", status_code=204)
async def logout(response: Response, current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    row = session.execute(select(PrivilegedStaffSession).where(PrivilegedStaffSession.token_hash == PrivilegedStaffSession.hash_token(token or ""), PrivilegedStaffSession.user_id == current_user.id, PrivilegedStaffSession.revoked_at.is_(None))).scalar_one_or_none()
    if row: row.revoked_at, row.revoke_reason = datetime.now(UTC), "logout"; session.commit()
    response.delete_cookie(STAFF_COOKIE, path="/"); return response

@router.get("/me", response_model=StaffMe)
async def me(current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    row=require_privileged(session,current_user,token,"staff.access"); session.commit(); return StaffMe(permissions=sorted(permissions_for(session,current_user)),privileged_expires_at=row.expires_at)

@router.get("/roles", response_model=list[RoleResponse])
async def roles(current_user: User=Depends(get_current_user), token: str|None=Cookie(default=None,alias=STAFF_COOKIE), session: Session=Depends(get_session)):
    require_privileged(session,current_user,token,"roles.manage"); return [RoleResponse(**effective_role_payload(r)) for r in session.execute(select(StaffRole).order_by(StaffRole.key)).scalars()]

@router.post("/roles", response_model=RoleResponse, status_code=201)
async def create_role(payload: RoleCreate,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"roles.manage"); perms=session.execute(select(StaffPermission).where(StaffPermission.key.in_(payload.permissions))).scalars().all()
    if len(perms)!=len(payload.permissions): from fastapi import HTTPException; raise HTTPException(422,"Unknown permission.")
    role=StaffRole(key=payload.key,display_name=payload.display_name,permissions=perms); session.add(role); audit(session,current_user,"role_created",{"role":role.key},privileged); session.commit(); return RoleResponse(**effective_role_payload(role))

@router.patch("/roles/{role_key}", response_model=RoleResponse)
async def update_role(role_key: str,payload: RoleUpdate,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"roles.manage"); role=session.execute(select(StaffRole).where(StaffRole.key==role_key)).scalar_one_or_none()
    if not role: from fastapi import HTTPException; raise HTTPException(404,"Role not found.")
    if payload.display_name is not None: role.display_name=payload.display_name
    if payload.permissions is not None:
        perms=session.execute(select(StaffPermission).where(StaffPermission.key.in_(payload.permissions))).scalars().all()
        if len(perms)!=len(payload.permissions): from fastapi import HTTPException; raise HTTPException(422,"Unknown permission.")
        role.permissions=perms
    audit(session,current_user,"role_updated",{"role":role.key},privileged); session.commit(); return RoleResponse(**effective_role_payload(role))

@router.get("/users", response_model=list[StaffUserResponse])
async def users(current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    require_privileged(session,current_user,token,"users.view"); return [StaffUserResponse(id=u.public_id,username=u.username,display_name=u.display_name,email=u.email,is_staff=u.is_staff,account_locked=u.account_locked,permissions=sorted(permissions_for(session,u))) for u in session.execute(select(User).order_by(User.username).limit(100)).scalars()]

@router.post("/users/{public_id}/roles", response_model=StaffUserResponse)
async def assign_role(public_id: str,payload: AssignmentRequest,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"roles.manage"); user=target(session,public_id); role=session.execute(select(StaffRole).where(StaffRole.key==payload.role_key)).scalar_one_or_none()
    if not role: from fastapi import HTTPException; raise HTTPException(404,"Role not found.")
    exists=session.execute(select(user_roles).where(user_roles.c.user_id==user.id,user_roles.c.role_id==role.id)).first()
    if payload.assigned and not exists: session.execute(user_roles.insert().values(user_id=user.id,role_id=role.id))
    elif not payload.assigned and exists:
        if role.key=="superadmin" and user.id==current_user.id: from fastapi import HTTPException; raise HTTPException(409,"You cannot remove your last superadmin access.")
        session.execute(user_roles.delete().where(user_roles.c.user_id==user.id,user_roles.c.role_id==role.id))
    audit(session,current_user,"role_assignment_changed",{"target":user.public_id,"role":role.key,"assigned":payload.assigned},privileged); session.commit(); return StaffUserResponse(id=user.public_id,username=user.username,display_name=user.display_name,email=user.email,is_staff=user.is_staff,account_locked=user.account_locked,permissions=sorted(permissions_for(session,user)))

@router.post("/users/{public_id}/grants", response_model=StaffUserResponse)
async def grant(public_id: str,payload: GrantRequest,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"roles.manage"); user=target(session,public_id); permission=session.execute(select(StaffPermission).where(StaffPermission.key==payload.permission)).scalar_one_or_none()
    if not permission: from fastapi import HTTPException; raise HTTPException(422,"Unknown permission.")
    existing=session.execute(select(UserPermissionGrant).where(UserPermissionGrant.user_id==user.id,UserPermissionGrant.permission_id==permission.id)).scalar_one_or_none()
    if payload.granted and not existing: session.add(UserPermissionGrant(user_id=user.id,permission_id=permission.id))
    elif not payload.granted and existing: session.delete(existing)
    audit(session,current_user,"direct_grant_changed",{"target":user.public_id,"permission":permission.key,"granted":payload.granted},privileged); session.commit(); return StaffUserResponse(id=user.public_id,username=user.username,display_name=user.display_name,email=user.email,is_staff=user.is_staff,account_locked=user.account_locked,permissions=sorted(permissions_for(session,user)))

@router.post("/users/{public_id}/staff", response_model=StaffUserResponse)
async def staff_status(public_id: str,payload: StaffStatusRequest,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"roles.manage"); user=target(session,public_id)
    if user.id==current_user.id and not payload.enabled: from fastapi import HTTPException; raise HTTPException(409,"You cannot remove your own staff access.")
    user.is_staff=payload.enabled
    if not payload.enabled: revoke_staff_sessions(session,user.id,"staff_removed")
    audit(session,current_user,"staff_status_changed",{"target":user.public_id,"enabled":payload.enabled},privileged); session.commit(); return StaffUserResponse(id=user.public_id,username=user.username,display_name=user.display_name,email=user.email,is_staff=user.is_staff,account_locked=user.account_locked,permissions=sorted(permissions_for(session,user)))

@router.post("/users/{public_id}/lock",status_code=204)
async def lock(public_id: str,payload: ReasonRequest,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"users.lock"); user=target(session,public_id)
    if user.id==current_user.id: from fastapi import HTTPException; raise HTTPException(409,"You cannot lock your own account.")
    user.account_locked=True; revoke_staff_sessions(session,user.id,"account_locked"); audit(session,current_user,"account_locked",{"target":user.public_id,"reason":payload.reason},privileged); session.commit(); return Response(status_code=204)

@router.post("/users/{public_id}/unlock",status_code=204)
async def unlock(public_id: str,payload: ReasonRequest,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"users.unlock"); user=target(session,public_id); user.account_locked=False; user.locked_until=None; audit(session,current_user,"account_unlocked",{"target":user.public_id,"reason":payload.reason},privileged); session.commit(); return Response(status_code=204)

@router.post("/users/{public_id}/sessions/revoke-all",status_code=204)
async def revoke_all(public_id: str,current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"sessions.revoke"); user=target(session,public_id)
    for row in session.execute(select(AuthSession).where(AuthSession.user_id==user.id,AuthSession.revoked_at.is_(None))).scalars(): row.revoked_at=datetime.now(UTC); row.revoke_reason="admin"
    revoke_staff_sessions(session,user.id,"admin"); audit(session,current_user,"sessions_revoked",{"target":user.public_id},privileged); session.commit(); return Response(status_code=204)

@router.post("/users/{public_id}/sessions/{session_id}/revoke", status_code=204)
async def revoke_one(public_id: str, session_id: str, current_user: User=Depends(get_current_user), token: str|None=Cookie(default=None,alias=STAFF_COOKIE), session: Session=Depends(get_session)):
    privileged=require_privileged(session,current_user,token,"sessions.revoke"); user=target(session,public_id)
    try: auth_session=session.get(AuthSession, session_id)
    except Exception: auth_session=None
    if not auth_session or auth_session.user_id != user.id: from fastapi import HTTPException; raise HTTPException(404,"Session not found.")
    auth_session.revoked_at=datetime.now(UTC); auth_session.revoke_reason="admin"; audit(session,current_user,"session_revoked",{"target":user.public_id,"session": "redacted"},privileged); session.commit(); return Response(status_code=204)

@router.get("/audit",response_model=list[AuditResponse])
async def audit_log(current_user: User=Depends(get_current_user),token: str|None=Cookie(default=None,alias=STAFF_COOKIE),session: Session=Depends(get_session)):
    require_privileged(session,current_user,token,"audit.view"); rows=session.execute(select(SecurityEvent).where(SecurityEvent.event_type=="staff_mutation").order_by(SecurityEvent.created_at.desc()).limit(100)).scalars(); return [AuditResponse(event_type=e.event_type.value,payload=e.payload,created_at=e.created_at) for e in rows]
