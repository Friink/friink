import asyncio
import hashlib
import secrets
import time
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.progressive_auth_flow import ProgressiveAuthFlow
from app.schemas.auth import SignupEmailStartRequest
from app.services.auth import (
    get_user_by_email,
    get_user_by_login_identifier,
    is_reserved_superadmin_email,
)
from app.services.session_ops import commit

FLOW_TTL = timedelta(minutes=10)
START_RESPONSE_FLOOR_SECONDS = 0.35
NEUTRAL_MESSAGE = "Continue securely."


def _token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii")).digest()


def _is_email(value: str) -> bool:
    try:
        SignupEmailStartRequest(email=value)
        return True
    except ValidationError:
        return False


async def create_progressive_flow(session: Session, identifier: str) -> str:
    normalized = identifier.strip()
    user = await get_user_by_login_identifier(session, normalized)
    if user is not None:
        flow_kind = "login"
    elif _is_email(normalized) and not is_reserved_superadmin_email(normalized):
        flow_kind = "signup"
    else:
        # Unknown usernames and reserved bootstrap identities remain in the
        # generic login path; signup is email-only.
        flow_kind = "login"

    raw_token = secrets.token_urlsafe(32)
    session.add(
        ProgressiveAuthFlow(
            token_hash=_token_hash(raw_token),
            identifier=normalized,
            flow_kind=flow_kind,
            expires_at=datetime.now(UTC) + FLOW_TTL,
        )
    )
    await commit(session)
    return raw_token


async def create_neutral_progressive_flow(session: Session, identifier: str) -> str:
    started = time.monotonic()
    token = await create_progressive_flow(session, identifier)
    remaining = START_RESPONSE_FLOOR_SECONDS - (time.monotonic() - started)
    if remaining > 0:
        await asyncio.sleep(remaining)
    return token


def _get_flow(session: Session, raw_token: str) -> ProgressiveAuthFlow:
    flow = session.execute(
        select(ProgressiveAuthFlow).where(ProgressiveAuthFlow.token_hash == _token_hash(raw_token))
    ).scalar_one_or_none()
    if not flow or flow.expires_at <= datetime.now(UTC) or flow.consumed_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This sign-in attempt is invalid or expired.")
    return flow


async def continue_progressive_flow(session: Session, raw_token: str) -> tuple[str, str]:
    flow = _get_flow(session, raw_token)
    if flow.flow_kind == "signup":
        # Re-check the email at the branch boundary so a concurrent account
        # creation cannot send a signup OTP to an address that became owned.
        existing_user = await get_user_by_email(session, flow.identifier)
        if existing_user is not None:
            flow.flow_kind = "login"
        else:
            flow.consumed_at = datetime.now(UTC)
            await commit(session)
            return "email_verification", NEUTRAL_MESSAGE
    flow.consumed_at = datetime.now(UTC)
    await commit(session)
    return "password", NEUTRAL_MESSAGE
