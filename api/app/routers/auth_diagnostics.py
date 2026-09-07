import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.services.auth_debug import get_deployment_sha

router = APIRouter(prefix="/internal/auth", tags=["internal-auth"])


def require_auth_diagnostics_token(
    x_auth_diagnostics_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.auth_diagnostics_internal_token or not x_auth_diagnostics_token or not secrets.compare_digest(x_auth_diagnostics_token, settings.auth_diagnostics_internal_token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")


@router.get("/diagnostics")
def auth_diagnostics(
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_auth_diagnostics_token),
) -> dict[str, bool | str]:
    return {
        "otp_enabled": settings.otp_enabled,
        "signup_otp_enabled": settings.signup_otp_enabled,
        "login_risk_otp_enabled": settings.login_risk_otp_enabled,
        "deployment_sha": get_deployment_sha(),
    }
