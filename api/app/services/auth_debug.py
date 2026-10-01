import json
import logging
import os
from datetime import UTC, datetime
import jwt

from app.config import Settings
from app.services.auth_errors import AuthErrorCode

logger = logging.getLogger("friink.auth")

AUTH_DEBUG_ENV_VALUES = {"1", "true", "yes", "on"}


def auth_debug_enabled() -> bool:
    return os.getenv("AUTH_DEBUG_LOGGING_ENABLED", "").strip().lower() in AUTH_DEBUG_ENV_VALUES


def get_deployment_sha() -> str:
    return os.getenv("VERCEL_GIT_COMMIT_SHA", "unknown")


def log_refresh_request_result(
    *, request, status_code: int, exception_type: str | None = None
) -> None:
    """Log a redacted outcome for every refresh request, correlated to its response."""
    account_slot = request.headers.get("X-Friink-Account-Slot")
    expected_cookie = f"friink_refresh_{account_slot}" if account_slot else None
    failure_class = getattr(request.state, "failure_code", None) or (
        "success"
        if status_code < 400
        else "client_error"
        if status_code < 500
        else "server_error"
    )
    logger.log(
        logging.WARNING if status_code >= 400 else logging.INFO,
        json.dumps(
            {
                "event": "auth_refresh_request",
                "request_id": getattr(request.state, "request_id", None),
                "request_method": request.method,
                "request_path": request.url.path,
                "deployment_sha": get_deployment_sha(),
                "status_code": status_code,
                "failure_class": failure_class,
                "exception_type": exception_type,
                "slot_header_present": bool(account_slot),
                "expected_slot_cookie_present": bool(expected_cookie and request.cookies.get(expected_cookie)),
                "server_time": int(datetime.now(UTC).timestamp()),
            }
        )
    )


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
                "reason": reason,
                "deployment_sha": get_deployment_sha(),
                "server_time": int(datetime.now(UTC).timestamp()),
            }
        )
    )


def log_account_slot_event(*, flow: str, device_cookie_present: bool, slot_created_or_reused: bool, add_account: bool) -> None:
    if not auth_debug_enabled():
        return

    logger.info(
        json.dumps(
            {
                "event": "auth_account_slot_resolution",
                "flow": flow,
                "device_cookie_present": device_cookie_present,
                "slot_created_or_reused": slot_created_or_reused,
                "add_account": add_account,
                "deployment_sha": get_deployment_sha(),
                "server_time": int(datetime.now(UTC).timestamp()),
            }
        )
    )


def log_account_list_event(*, account_count: int, device_cookie_present: bool) -> None:
    if not auth_debug_enabled():
        return

    logger.info(
        json.dumps(
            {
                "event": "auth_account_list",
                "account_count": account_count,
                "device_cookie_present": device_cookie_present,
                "deployment_sha": get_deployment_sha(),
                "server_time": int(datetime.now(UTC).timestamp()),
            }
        )
    )


def log_account_switch_event(*, result: str, reason: str | None = None) -> None:
    if not auth_debug_enabled():
        return

    logger.info(
        json.dumps(
            {
                "event": "auth_account_switch",
                "result": result,
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
    request_id: str | None = None,
    slot_header_present: bool | None = None,
    slot_cookie_present: bool | None = None,
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
                "request_id": request_id,
                "slot_header_present": slot_header_present,
                "expected_slot_cookie_present": slot_cookie_present,
            }
        )
    )
