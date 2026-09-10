from fastapi import APIRouter, Cookie, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.subscription import Plan, SubscriptionAssignment
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.subscriptions import PlanResponse, SubscriptionAssignmentResponse, SubscriptionGrantRequest, SubscriptionResponse, SubscriptionRevokeRequest
from app.services.staff import require_superadmin
from app.services.subscriptions import effective_plan, effective_status, grant, revoke
from app.routers.staff import STAFF_COOKIE, target

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

def _read(user: User, session: Session) -> SubscriptionResponse:
    plan = effective_plan(user, session)
    assignment = next((a for a in session.execute(select(SubscriptionAssignment).where(SubscriptionAssignment.user_id == user.id).order_by(SubscriptionAssignment.created_at.desc())).scalars().all() if effective_status(a) == "active"), None)
    return SubscriptionResponse(plan_code=plan.code, plan_name=plan.name, expires_at=assignment.expires_at if assignment else None, status="active", assignment_id=str(assignment.id) if assignment else None)

@router.get("/me", response_model=SubscriptionResponse)
async def me(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return _read(current_user, session)

@router.get("/admin/plans", response_model=list[PlanResponse])
async def admin_plans(current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    require_superadmin(session, current_user, token)
    return [PlanResponse(code=p.code, name=p.name, description=p.description, active=p.active) for p in session.execute(select(Plan).order_by(Plan.code)).scalars()]

@router.post("/admin/users/{public_id}/grant", response_model=SubscriptionAssignmentResponse)
async def admin_grant(public_id: str, payload: SubscriptionGrantRequest, current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    require_superadmin(session, current_user, token)
    user = target(session, public_id); assignment = grant(session, current_user, user, payload.plan_code, payload.duration_days, payload.reason)
    return _assignment_response(assignment)

@router.post("/admin/users/{public_id}/revoke", response_model=SubscriptionAssignmentResponse)
async def admin_revoke(public_id: str, payload: SubscriptionRevokeRequest, current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    require_superadmin(session, current_user, token)
    assignment = revoke(session, current_user, target(session, public_id), payload.reason)
    return _assignment_response(assignment)

@router.get("/admin/users/{public_id}/assignments", response_model=list[SubscriptionAssignmentResponse])
async def admin_assignments(public_id: str, current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    require_superadmin(session, current_user, token)
    user = target(session, public_id)
    rows = session.execute(select(SubscriptionAssignment).where(SubscriptionAssignment.user_id == user.id).order_by(SubscriptionAssignment.created_at.desc())).scalars()
    return [_assignment_response(row) for row in rows]

def _assignment_response(row: SubscriptionAssignment) -> SubscriptionAssignmentResponse:
    return SubscriptionAssignmentResponse(user_id=row.user.public_id, plan_code=row.plan.code, plan_name=row.plan.name, expires_at=row.expires_at, status=effective_status(row), assignment_id=str(row.id), starts_at=row.starts_at, reason=row.reason, created_at=row.created_at, revoked_at=row.revoked_at)
