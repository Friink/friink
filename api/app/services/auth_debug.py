import json
import logging
import os
from datetime import UTC, datetime
from typing import Any

import jwt

from app.config import Settings
from app.services.auth_errors import AuthErrorCode

logger = logging.getLogger("friink.auth")

AUTH_DEBUG_ENV_VALUES = {"1", "true", "yes", "on"}


def auth_debug_enabled() -> bool:
    return os.getenv("AUTH_DEBUG_LOGGING_ENABLED", "").strip().lower() in AUTH_DEBUG_ENV_VALUES


def get_deployment_sha() -> str:
    return os.getenv("VERCEL_GIT_COMMIT_SHA", "unknown")


def get_token_timestamps_unverified(token: str) -> dict[str, int | None]:
    try:
        payload = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
    except jwt.PyJWTError:
        return {"iat": None, "exp": None}
    return {
        "iat": payload.get("iat") if isinstance(payload.get("iat"), int) else None,
        "exp": payload.get("exp") if isinstance(payload.get("exp"), int) else None,
    }


def log_token_issued(*, flow: str, token_type: str, token: str, user_id: str) -> None:
    if not auth_debug_enabled():
        return

    timestamps = get_token_timestamps_unverified(token)
    logger.info(
        json.dumps(
            {
                "event": "auth_token_issued",
                "flow": flow,
                "token_type": token_type,
                "user_id": user_id,
                "deployment_sha": get_deployment_sha(),
                "iat": timestamps["iat"],
                "exp": timestamps["exp"],
                "server_time": int(datetime.now(UTC).timestamp()),
            }
        )
    )


def log_refresh_token_event(*, event: str, flow: str, token_id: str, family_id: str, user_id: str, reason: str | None = None) -> None:
    if not auth_debug_enabled():
        return

    logger.info(
        json.dumps(
            {
                "event": event,
                "flow": flow,
                "token_id": token_id,
                "family_id": family_id,
                "user_id": user_id,
                "reason": reason,
                "deployment_sha": get_deployment_sha(),
                "server_time": int(datetime.now(UTC).timestamp()),
            }
        )
    )


def log_token_verification_failure(
    *,
    flow: str,
    token_type: str,
    token: str,
    exception: Exception,
    settings: Settings,
    request_path: str | None = None,
    request_method: str | None = None,
) -> None:
    if not auth_debug_enabled():
        return

    timestamps = get_token_timestamps_unverified(token)
    logger.warning(
        json.dumps(
            {
                "event": "auth_token_verification_failed",
                "flow": flow,
                "token_type": token_type,
                "exception_type": type(exception).__name__,
                "exception_message": str(exception),
                "deployment_sha": get_deployment_sha(),
                "jwt_algorithm": settings.jwt_algorithm,
                "iat": timestamps["iat"],
                "exp": timestamps["exp"],
                "server_time": int(datetime.now(UTC).timestamp()),
                "request_path": request_path,
                "request_method": request_method,
            }
        )
    )


def log_auth_failure(
    *,
    flow: str,
    token_type: str,
    code: AuthErrorCode,
    reason: str,
    settings: Settings,
    request_path: str | None = None,
    request_method: str | None = None,
) -> None:
    logger.warning(
        json.dumps(
            {
                "event": "auth_failure_classified",
                "flow": flow,
                "token_type": token_type,
                "code": code.value,
                "reason": reason,
                "deployment_sha": get_deployment_sha(),
                "jwt_algorithm": settings.jwt_algorithm,
                "server_time": int(datetime.now(UTC).timestamp()),
                "request_path": request_path,
                "request_method": request_method,
            }
        )
    )
