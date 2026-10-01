import hashlib
import logging
import time
from typing import Any

from fastapi import Request

from app.config import get_settings
from app.db import get_session_factory
from app.models.auth_refresh_attempt import AuthRefreshAttempt


logger = logging.getLogger("friink.auth")


def _hash_identifier(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _failure_class(status_code: int) -> str:
    if status_code < 400:
        return "success"
    if status_code < 500:
        return "client_error"
    return "server_error"


def record_refresh_attempt(
    *,
    request: Request,
    status_code: int,
    exception_type: str | None = None,
) -> None:
    """Persist redacted refresh diagnostics without affecting authentication."""
    request_id = getattr(request.state, "request_id", None)
    if not request_id:
        return

    headers = request.headers
    slot = headers.get("X-Friink-Account-Slot")
    expected_cookie = f"friink_refresh_{slot}" if slot else "friink_refresh_token"
    started_at = getattr(request.state, "refresh_started_at", None)
    duration_ms = max(0, int((time.perf_counter() - started_at) * 1000)) if started_at else 0
    settings = get_settings()
    values: dict[str, Any] = {
        "request_id": request_id,
        "refresh_operation_id": headers.get("X-Friink-Refresh-Operation-Id"),
        "client_tab_id_hash": _hash_identifier(headers.get("X-Friink-Client-Tab-Id")),
        "user_id": getattr(request.state, "refresh_user_id", None),
        "session_id": getattr(request.state, "refresh_session_id", None),
        "account_slot_hash": _hash_identifier(slot),
        "result": "success" if status_code < 400 else "failure",
        "status_code": status_code,
        "failure_code": getattr(request.state, "failure_code", None),
        "failure_class": _failure_class(status_code),
        "exception_type": exception_type,
        "deployment_sha": settings.deployment_sha,
        "slot_header_present": bool(slot),
        "expected_slot_cookie_present": bool(request.cookies.get(expected_cookie)),
        "duration_ms": duration_ms,
    }
    try:
        with get_session_factory()() as session:
            session.add(AuthRefreshAttempt(**values))
            session.commit()
    except Exception:
        logger.exception("Unable to persist auth refresh diagnostics")
