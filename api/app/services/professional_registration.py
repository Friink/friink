from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.professional_registration import ProfessionalRegistration
from app.models.user import User
from app.services.notifications import create_notification
from app.models.notification import NotificationType
from app.services.subscriptions import has_entitlement


def now() -> datetime:
    return datetime.now(UTC)


def latest(session: Session, user: User) -> ProfessionalRegistration | None:
    return session.execute(select(ProfessionalRegistration).where(ProfessionalRegistration.user_id == user.id).order_by(ProfessionalRegistration.created_at.desc())).scalars().first()


def registered(session: Session, user: User) -> ProfessionalRegistration | None:
    return session.execute(select(ProfessionalRegistration).where(ProfessionalRegistration.user_id == user.id, ProfessionalRegistration.status == "registered").order_by(ProfessionalRegistration.decided_at.desc())).scalars().first()


def directory_eligible(session: Session, user: User) -> bool:
    return has_entitlement(user, "professional_directory", session) and (user.use_intent == "professional" or registered(session, user) is not None)


def response(session: Session, user: User) -> dict:
    row = latest(session, user)
    active = registered(session, user)
    return {"user_id": user.public_id, "username": user.username, "display_name": user.display_name, "email": user.email, "profile_picture_url": user.profile_picture_url, "id": str(row.id) if row else None, "status": row.status if row else None, "institute": active.institute if active else (row.institute if row else None), "credential_id": active.credential_id if active else (row.credential_id if row else None), "decision_message": row.decision_message if row else None, "show_registered_badge": bool(user.show_registered_badge and active), "show_in_directory": bool(user.show_in_directory), "professional": user.use_intent == "professional", "directory_eligible": directory_eligible(session, user), "created_at": row.created_at if row else None, "decided_at": row.decided_at if row else None}


def submit(session: Session, user: User, institute: str, credential_id: str) -> ProfessionalRegistration:
    pending = session.execute(select(ProfessionalRegistration).where(ProfessionalRegistration.user_id == user.id, ProfessionalRegistration.status == "pending")).scalar_one_or_none()
    if pending:
        raise HTTPException(status_code=409, detail="A registration request is already pending.")
    row = ProfessionalRegistration(user_id=user.id, institute=institute.strip(), credential_id=credential_id.strip())
    session.add(row)
    create_notification(session, recipient_user_id=user.id, notification_type=NotificationType.professional_registration_submitted, payload={"registration_id": str(row.id)})
    session.commit(); session.refresh(row)
    return row


def cancel(session: Session, user: User) -> ProfessionalRegistration:
    row = session.execute(select(ProfessionalRegistration).where(ProfessionalRegistration.user_id == user.id, ProfessionalRegistration.status == "pending")).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="No pending registration request.")
    row.status = "cancelled"; row.decided_at = now(); session.commit(); session.refresh(row); return row


def decide(session: Session, actor: User, row: ProfessionalRegistration, action: str, message: str | None) -> ProfessionalRegistration:
    if action == "approve":
        if row.status != "pending": raise HTTPException(status_code=409, detail="Only pending requests can be approved.")
        row.status = "registered"; row.decision_message = message; row.decided_by_user_id = actor.id; row.decided_at = now(); row.user.show_registered_badge = True; event = NotificationType.professional_registration_approved
    elif action == "reject":
        if row.status != "pending": raise HTTPException(status_code=409, detail="Only pending requests can be rejected.")
        if not message or not message.strip(): raise HTTPException(status_code=422, detail="A rejection message is required.")
        row.status = "rejected"; row.decision_message = message.strip(); row.decided_by_user_id = actor.id; row.decided_at = now(); event = NotificationType.professional_registration_rejected
    else:
        if row.status != "registered": raise HTTPException(status_code=409, detail="Only registered requests can be revoked.")
        if not message or not message.strip(): raise HTTPException(status_code=422, detail="A revocation message is required.")
        row.status = "revoked"; row.decision_message = message.strip(); row.decided_by_user_id = actor.id; row.decided_at = now(); row.user.show_registered_badge = False; row.user.show_in_directory = False; event = NotificationType.professional_registration_revoked
    create_notification(session, recipient_user_id=row.user_id, notification_type=event, actor_user_id=actor.id, payload={"registration_id": str(row.id), "message": row.decision_message})
    session.commit(); session.refresh(row); return row
