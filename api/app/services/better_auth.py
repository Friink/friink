from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request, status

from app.config import Settings


@dataclass(frozen=True)
class BetterAuthIdentity:
    id: str
    email: str
    name: str
    username: str | None
    email_verified: bool
    onboarding_status: str | None
    expires_at: str


async def introspect_better_auth(request: Request, settings: Settings) -> BetterAuthIdentity:
    if not settings.auth_internal_token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth session validation is not configured.")
    cookie = request.headers.get("cookie")
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth session is not available.")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{str(settings.auth_service_url).rstrip('/')}/api/auth/introspect",
                headers={"Cookie": cookie, "X-Friink-Auth-Internal-Token": settings.auth_internal_token},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth session validation is unavailable.") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth session is not available.")
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth session validation failed.")

    body = response.json()
    user = body.get("user") if isinstance(body, dict) else None
    session = body.get("session") if isinstance(body, dict) else None
    if not isinstance(user, dict) or not isinstance(session, dict) or not isinstance(user.get("id"), str):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth returned an invalid session response.")

    return BetterAuthIdentity(
        id=user["id"],
        email=str(user.get("email", "")),
        name=str(user.get("name", "")),
        username=user.get("username") if isinstance(user.get("username"), str) else None,
        email_verified=bool(user.get("emailVerified")),
        onboarding_status=user.get("onboardingStatus") if isinstance(user.get("onboardingStatus"), str) else None,
        expires_at=str(session.get("expiresAt", "")),
    )
