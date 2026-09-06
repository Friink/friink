from datetime import UTC, datetime
import secrets
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.services.account_lifecycle import process_pending_deletions

router = APIRouter(prefix="/internal/account-lifecycle", tags=["internal-account-lifecycle"])


def require_internal_token(
    x_account_lifecycle_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.account_lifecycle_internal_token or not x_account_lifecycle_token or not secrets.compare_digest(x_account_lifecycle_token, settings.account_lifecycle_internal_token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")


@router.post("/process")
def process_lifecycle_jobs(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> dict[str, int]:
    return {"processed": process_pending_deletions(session, settings)}


@router.post("/{user_id}/complete")
def complete_failed_deletion(
    user_id: uuid.UUID,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> dict[str, str]:
    user = session.get(User, user_id)
    if not user or user.lifecycle_status != "pending_deletion":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deletion request not found.")
    user.deletion_deadline = datetime.now(UTC)
    session.commit()
    process_pending_deletions(session, settings, limit=1)
    return {"status": "completed"}
