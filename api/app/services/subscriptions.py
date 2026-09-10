from datetime import UTC, datetime, timedelta
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.security_event import SecurityEventType
from app.services.security_events import record_security_event_safely
from app.models.subscription import Plan, PlanEntitlement, SubscriptionAssignment
from app.models.user import User

FREE_CODE = "friink_free"
ENTITLEMENTS = (
    "message_requests", "profile_views", "longer_posts", "professional_registration",
    "professional_directory", "analytics", "profile_boost", "reduced_ads",
)
PLAN_ENTITLEMENTS = {
    FREE_CODE: set(),
    "friink_pro": {"message_requests", "profile_views", "longer_posts", "professional_registration", "professional_directory"},
    "friink_pro_plus": {"message_requests", "profile_views", "longer_posts", "professional_registration", "professional_directory", "analytics", "profile_boost", "reduced_ads"},
}

def utc_now() -> datetime:
    return datetime.now(UTC)

def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value

def assignment_is_effective(assignment: SubscriptionAssignment, now: datetime | None = None) -> bool:
    now = now or utc_now()
    return assignment.status == "active" and _aware(assignment.starts_at) <= now and (assignment.expires_at is None or _aware(assignment.expires_at) > now)

def active_assignment(session: Session, user: User, now: datetime | None = None) -> SubscriptionAssignment | None:
    rows = session.execute(select(SubscriptionAssignment).where(SubscriptionAssignment.user_id == user.id).order_by(SubscriptionAssignment.created_at.desc())).scalars().all()
    effective = [row for row in rows if assignment_is_effective(row, now)]
    return effective[0] if effective else None

def effective_plan(user: User, session: Session) -> Plan:
    assignment = active_assignment(session, user)
    if assignment is not None:
        return assignment.plan
    return session.execute(select(Plan).where(Plan.code == FREE_CODE)).scalar_one()

def has_entitlement(user: User, key: str, session: Session) -> bool:
    assignment = active_assignment(session, user)
    if assignment is None:
        return False
    return session.execute(select(PlanEntitlement).where(PlanEntitlement.plan_id == assignment.plan_id, PlanEntitlement.entitlement_key == key)).scalar_one_or_none() is not None

def effective_status(assignment: SubscriptionAssignment, now: datetime | None = None) -> str:
    if assignment.status == "revoked":
        return "revoked"
    return "active" if assignment_is_effective(assignment, now) else "expired"

def _audit(session: Session, actor: User, kind: str, assignment: SubscriptionAssignment, reason: str, replaced_id: uuid.UUID | None = None) -> None:
    record_security_event_safely(
        session,
        event_type=SecurityEventType.staff_mutation,
        event_key=f"subscription:{kind}:{assignment.id}:{uuid.uuid4()}",
        user_id=actor.id,
        payload={"kind": kind, "target_user": assignment.user_id.hex, "assignment_id": str(assignment.id), "plan": assignment.plan.code, "reason": reason, "replaced_assignment_id": str(replaced_id) if replaced_id else None},
    )

def grant(session: Session, actor: User, user: User, plan_code: str, duration_days: int | None, reason: str) -> SubscriptionAssignment:
    if duration_days is not None and not 1 <= duration_days <= 3650:
        raise HTTPException(422, "duration_days must be between 1 and 3650.")
    plan = session.execute(select(Plan).where(Plan.code == plan_code, Plan.active.is_(True))).scalar_one_or_none()
    if plan is None:
        raise HTTPException(422, "Plan is not assignable.")
    now = utc_now()
    prior = active_assignment(session, user, now)
    if prior:
        prior.status = "revoked"; prior.revoked_at = now; prior.revoked_by_user_id = actor.id
    assignment = SubscriptionAssignment(user_id=user.id, plan_id=plan.id, starts_at=now, expires_at=now + timedelta(days=duration_days) if duration_days is not None else None, status="active", granted_by_user_id=actor.id, reason=reason)
    session.add(assignment)
    session.flush()
    replaced_id = prior.id if prior else None
    session.commit()
    session.refresh(assignment)
    _audit(session, actor, "subscription_granted", assignment, reason, replaced_id)
    if prior:
        _audit(session, actor, "subscription_replaced", prior, reason, assignment.id)
    return assignment

def revoke(session: Session, actor: User, user: User, reason: str) -> SubscriptionAssignment:
    assignment = active_assignment(session, user)
    if assignment is None:
        raise HTTPException(404, "No active subscription assignment.")
    assignment.status = "revoked"; assignment.revoked_at = utc_now(); assignment.revoked_by_user_id = actor.id
    session.commit()
    session.refresh(assignment)
    _audit(session, actor, "subscription_revoked", assignment, reason)
    return assignment
