from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models.professional_registration import ProfessionalRegistration
from app.models.user import User
from app.routers.auth import get_current_user
from app.routers.staff import STAFF_COOKIE, target
from app.schemas.professional_registration import DirectoryProfileResponse, RegistrationApplicationRequest, RegistrationDecisionRequest, RegistrationPreferencesRequest, RegistrationResponse
from app.services.professional_registration import cancel, decide, directory_eligible, latest, response, submit
from app.services.staff import require_privileged
from app.config import get_settings
from app.services.email import EmailService


def _registration_email(user: User, event: str, message: str | None = None) -> None:
    import asyncio
    asyncio.run(EmailService(get_settings()).send_professional_registration_update(user, event, message))

router = APIRouter(tags=["professional registration"])


@router.get("/professional-registration", response_model=RegistrationResponse)
async def get_registration(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return response(session, current_user)


@router.post("/professional-registration", response_model=RegistrationResponse, status_code=201)
async def apply_registration(payload: RegistrationApplicationRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    submit(session, current_user, payload.institute, payload.credential_id)
    background_tasks.add_task(_registration_email, current_user, "professional_registration_submitted")
    return response(session, current_user)


@router.post("/professional-registration/cancel", response_model=RegistrationResponse)
async def cancel_registration(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    cancel(session, current_user)
    return response(session, current_user)


@router.patch("/professional-registration/preferences", response_model=RegistrationResponse)
async def update_preferences(payload: RegistrationPreferencesRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    active = latest(session, current_user)
    registered = bool(active and active.status == "registered")
    if payload.show_registered_badge is not None:
        if payload.show_registered_badge and not registered:
            from fastapi import HTTPException
            raise HTTPException(409, "The Friink Registered badge is unavailable until registration is approved.")
        current_user.show_registered_badge = payload.show_registered_badge
    if payload.show_in_directory is not None:
        if payload.show_in_directory and not directory_eligible(session, current_user):
            from fastapi import HTTPException
            raise HTTPException(409, "Directory listing requires an eligible subscription and professional status.")
        current_user.show_in_directory = payload.show_in_directory
    session.commit()
    return response(session, current_user)


@router.get("/directory", response_model=list[DirectoryProfileResponse])
async def directory(limit: int = Query(default=20, ge=1, le=100), session: Session = Depends(get_session)):
    users = session.execute(select(User).where(User.lifecycle_status == "active", User.show_in_directory.is_(True)).order_by(User.username).limit(limit)).scalars().all()
    result = []
    for user in users:
        if not directory_eligible(session, user):
            continue
        row = latest(session, user)
        registered = row if row and row.status == "registered" else None
        result.append(DirectoryProfileResponse(public_id=user.public_id, username=user.username, display_name=user.display_name, about=user.about, profile_picture_url=user.profile_picture_url, professional=user.use_intent == "professional", friink_registered=bool(registered), institute=registered.institute if registered else None, credential_id=registered.credential_id if registered else None))
    return result


@router.get("/staff/professional-registrations", response_model=list[RegistrationResponse])
async def staff_registrations(status: str = Query(default="pending", pattern="^(pending|registered|rejected|cancelled|revoked|all)$"), q: str | None = Query(default=None, max_length=320), current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    require_privileged(session, current_user, token, "professional_registration.manage")
    statement = select(ProfessionalRegistration).join(User, ProfessionalRegistration.user_id == User.id).order_by(ProfessionalRegistration.created_at)
    if status != "all": statement = statement.where(ProfessionalRegistration.status == status)
    if q and q.strip():
        pattern = f"%{q.strip().casefold()}%"
        statement = statement.where(or_(User.username_key.ilike(pattern), User.email.ilike(pattern), User.display_name.ilike(pattern), ProfessionalRegistration.institute.ilike(pattern), ProfessionalRegistration.credential_id.ilike(pattern)))
    rows = session.execute(statement.limit(100)).scalars().all()
    return [response(session, row.user) for row in rows]


@router.post("/staff/professional-registrations/{registration_id}/decision", response_model=RegistrationResponse)
async def staff_decision(registration_id: str, payload: RegistrationDecisionRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), token: str | None = Cookie(default=None, alias=STAFF_COOKIE), session: Session = Depends(get_session)):
    require_privileged(session, current_user, token, "professional_registration.manage")
    row = session.get(ProfessionalRegistration, registration_id)
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Registration request not found.")
    decide(session, current_user, row, payload.action, payload.message)
    event = {"approve": "professional_registration_approved", "reject": "professional_registration_rejected", "revoke": "professional_registration_revoked"}[payload.action]
    background_tasks.add_task(_registration_email, row.user, event, payload.message)
    return response(session, row.user)
