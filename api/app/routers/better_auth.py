from fastapi import APIRouter, Depends, Request

from app.config import Settings, get_settings
from app.schemas.better_auth import BetterAuthSessionResponse, BetterAuthUserResponse
from app.services.better_auth import introspect_better_auth

router = APIRouter(prefix="/auth", tags=["better-auth-bridge"])


@router.get("/better-session", response_model=BetterAuthSessionResponse)
async def better_auth_session(request: Request, settings: Settings = Depends(get_settings)) -> BetterAuthSessionResponse:
    identity = await introspect_better_auth(request, settings)
    return BetterAuthSessionResponse(
        user=BetterAuthUserResponse(
            id=identity.id,
            email=identity.email,
            name=identity.name,
            username=identity.username,
            email_verified=identity.email_verified,
            onboarding_status=identity.onboarding_status,
        ),
        expires_at=identity.expires_at,
    )
