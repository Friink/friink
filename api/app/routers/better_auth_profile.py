import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.models.identity_history import UserUsernameHistory
from app.schemas.better_auth import BetterAuthProfileProvisionRequest
from app.services.auth import is_username_available

router = APIRouter(prefix="/auth", tags=["better-auth-bridge"])


@router.post("/better-profile", status_code=status.HTTP_201_CREATED)
async def provision_better_auth_profile(
    payload: BetterAuthProfileProvisionRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    if not settings.auth_internal_token or request.headers.get("x-friink-auth-internal-token") != settings.auth_internal_token:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        user_id = uuid.UUID(payload.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid user identity") from exc
    existing = session.get(User, user_id)
    if existing:
        if existing.email.casefold() != str(payload.email).casefold():
            raise HTTPException(status_code=409, detail="Profile identity conflict")
        return {"id": str(existing.id), "username": existing.username}
    if not await is_username_available(session, payload.username):
        raise HTTPException(status_code=409, detail="Username is already taken")
    user = User(
        id=user_id,
        email=str(payload.email).casefold(),
        username=payload.username,
        username_key=payload.username.casefold(),
        display_name=payload.name.strip() or payload.username,
        password_hash=f"better-auth-managed:{secrets.token_urlsafe(32)}",
        date_of_birth=payload.date_of_birth,
        is_verified=True,
        setup_step=1,
        setup_completed=False,
    )
    session.add(user)
    # Materialize the parent row before inserting its history record. Without
    # this flush, PostgreSQL may order the two independent pending inserts with
    # the history row first, violating the foreign-key constraint.
    session.flush()
    session.add(UserUsernameHistory(user_id=user_id, username_key=user.username_key, username_display=user.username, event_type="created"))
    session.commit()
    return {"id": str(user.id), "username": user.username}
