from datetime import UTC, datetime
import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models.security_event import SecurityEvent, SecurityEventType
from app.models.user import User
from app.schemas.auth_operations import AuthOperationRequest
from app.services.security_events import record_security_event_safely
from app.services.session_service import revoke_all_user_sessions
from app.services.staff import revoke_staff_sessions

router = APIRouter(prefix="/internal/auth/operations", tags=["internal-auth-operations"])


def require_operations_token(
    x_auth_operations_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.auth_operations_internal_token or not x_auth_operations_token or not secrets.compare_digest(x_auth_operations_token, settings.auth_operations_internal_token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")


def _require_confirmation(payload: AuthOperationRequest) -> None:
    if not payload.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Confirmation is required.")


def _operation_event_key(scope: str, idempotency_key: str | None) -> str:
    if not idempotency_key or len(idempotency_key) > 128:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid Idempotency-Key is required.")
    key_digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
    return f"auth-operation:{scope}:{key_digest}"


def _completed_result(session: Session, event_key: str) -> dict[str, object] | None:
    event = session.execute(select(SecurityEvent).where(SecurityEvent.event_key == event_key)).scalar_one_or_none()
    if not event:
        return None
    result = event.payload.get("result") if isinstance(event.payload, dict) else None
    return result if isinstance(result, dict) else None


@router.post("/users/{user_id}/revoke-all")
def revoke_user_sessions(
    user_id: uuid.UUID,
    payload: AuthOperationRequest,
    session: Session = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    _: None = Depends(require_operations_token),
) -> dict[str, object]:
    _require_confirmation(payload)
    event_key = _operation_event_key(f"revoke-user:{user_id}", idempotency_key)
    previous = _completed_result(session, event_key)
    if previous:
        return previous
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.security_epoch += 1
    counts = revoke_all_user_sessions(session, user.id, "security_incident")
    record_security_event_safely(
        session,
        event_type=SecurityEventType.staff_mutation,
        event_key=event_key,
        user_id=user.id,
        payload={"kind": "security_mass_revocation", "scope": "user", "reason": payload.reason, "counts": counts, "result": {"status": "completed", "scope": "user", "counts": counts}},
    )
    session.commit()
    return {"status": "completed", "scope": "user", "counts": counts}


@router.post("/users/{user_id}/contain-admin")
def contain_compromised_admin(
    user_id: uuid.UUID,
    payload: AuthOperationRequest,
    session: Session = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    _: None = Depends(require_operations_token),
) -> dict[str, object]:
    """Contain a compromised staff account without relying on that account."""
    _require_confirmation(payload)
    event_key = _operation_event_key(f"contain-admin:{user_id}", idempotency_key)
    previous = _completed_result(session, event_key)
    if previous:
        return previous
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_staff = False
    user.account_locked = True
    user.security_epoch += 1
    counts = revoke_all_user_sessions(session, user.id, "security_incident")
    counts["privileged_sessions"] = revoke_staff_sessions(session, user.id, "security_incident")
    record_security_event_safely(
        session,
        event_type=SecurityEventType.staff_mutation,
        event_key=event_key,
        user_id=user.id,
        payload={"kind": "compromised_admin_contained", "scope": "user", "reason": payload.reason, "counts": counts, "result": {"status": "contained", "scope": "user", "counts": counts}},
    )
    session.commit()
    return {"status": "contained", "scope": "user", "counts": counts}


@router.post("/revoke-all")
def revoke_all_sessions(
    payload: AuthOperationRequest,
    session: Session = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    _: None = Depends(require_operations_token),
) -> dict[str, object]:
    _require_confirmation(payload)
    event_key = _operation_event_key("revoke-all", idempotency_key)
    previous = _completed_result(session, event_key)
    if previous:
        return previous
    users = session.execute(select(User).where(User.lifecycle_status != "deleted")).scalars().all()
    totals = {"users": 0, "sessions": 0, "refresh_tokens": 0, "devices": 0}
    for user in users:
        user.security_epoch += 1
        counts = revoke_all_user_sessions(session, user.id, "security_incident")
        totals["users"] += 1
        for key in ("sessions", "refresh_tokens", "devices"):
            totals[key] += counts[key]
    result = {"status": "completed", "scope": "all_accounts", "counts": totals, "completed_at": datetime.now(UTC).isoformat()}
    record_security_event_safely(
        session,
        event_type=SecurityEventType.staff_mutation,
        event_key=event_key,
        payload={"kind": "security_mass_revocation", "scope": "all_accounts", "reason": payload.reason, "counts": totals, "result": result},
    )
    session.commit()
    return result
