from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_session
from app.services.login_throttling import enforce_ip_throttle
from app.services.progressive_auth import (
    NEUTRAL_MESSAGE,
    continue_progressive_flow,
    create_neutral_progressive_flow,
)
from app.routers.auth import require_allowed_origin

router = APIRouter(prefix="/auth/progressive", tags=["progressive-auth"])


class ProgressiveStartRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=320)


class ProgressiveStartResponse(BaseModel):
    accepted: bool = True
    flow_token: str = Field(min_length=32, max_length=128)
    message: str = NEUTRAL_MESSAGE


class ProgressiveContinueRequest(BaseModel):
    flow_token: str = Field(min_length=32, max_length=128)


class ProgressiveContinueResponse(BaseModel):
    next_step: Literal["password", "email_verification"]
    message: str = NEUTRAL_MESSAGE


def _require_enabled(settings: Settings) -> None:
    if not settings.progressive_login_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progressive login is not available.")


@router.post("/start", response_model=ProgressiveStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def progressive_start(
    payload: ProgressiveStartRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ProgressiveStartResponse:
    _require_enabled(settings)
    require_allowed_origin(request, settings)
    enforce_ip_throttle(session, request, settings)
    token = await create_neutral_progressive_flow(session, payload.identifier)
    return ProgressiveStartResponse(flow_token=token)


@router.post("/continue", response_model=ProgressiveContinueResponse)
async def progressive_continue(
    payload: ProgressiveContinueRequest,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ProgressiveContinueResponse:
    _require_enabled(settings)
    require_allowed_origin(request, settings)
    enforce_ip_throttle(session, request, settings)
    next_step, message = await continue_progressive_flow(session, payload.flow_token)
    return ProgressiveContinueResponse(next_step=next_step, message=message)
