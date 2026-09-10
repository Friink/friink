import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.login_ip_throttle import LoginIpThrottle

ACCOUNT_FAILURE_RESET = timedelta(hours=24)
ACCOUNT_COOLDOWN_SCHEDULE = (
    (9, timedelta(minutes=15)),
    (6, timedelta(minutes=5)),
    (4, timedelta(minutes=1)),
)
IP_WINDOW = timedelta(minutes=10)
IP_MAX_ATTEMPTS = 100
IP_COOLDOWN = timedelta(minutes=1)


def account_cooldown_for_attempt(attempts: int) -> timedelta | None:
    for threshold, duration in ACCOUNT_COOLDOWN_SCHEDULE:
        if attempts >= threshold:
            return duration
    return None


def clear_expired_account_failure_state(user, now: datetime) -> None:
    if user.failed_login_last_at and now - user.failed_login_last_at >= ACCOUNT_FAILURE_RESET:
        user.failed_login_attempts = 0
        user.failed_login_last_at = None
        user.locked_until = None


def ip_key(request: Request, settings: Settings) -> bytes:
    address = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"{settings.jwt_secret_key}:login-ip:{address}".encode("utf-8")).digest()


def enforce_ip_throttle(session: Session, request: Request, settings: Settings) -> None:
    now = datetime.now(UTC)
    key = ip_key(request, settings)
    record = session.execute(
        select(LoginIpThrottle).where(LoginIpThrottle.key_hash == key).with_for_update()
    ).scalar_one_or_none()
    if record is None:
        record = LoginIpThrottle(key_hash=key, attempt_count=0, window_started_at=now, updated_at=now)
        session.add(record)
        session.flush()
    if record.cooldown_until and record.cooldown_until > now:
        remaining = max(1, int((record.cooldown_until - now).total_seconds() + 0.999))
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many sign-in attempts. Please try again shortly.",
                "code": "IP_RATE_LIMIT",
                "cooldown_seconds": remaining,
            },
        )
    if now - record.window_started_at >= IP_WINDOW:
        record.attempt_count = 0
        record.window_started_at = now
        record.cooldown_until = None
    record.attempt_count += 1
    record.updated_at = now
    if record.attempt_count > IP_MAX_ATTEMPTS:
        record.cooldown_until = now + IP_COOLDOWN
    session.commit()
    if record.cooldown_until and record.cooldown_until > now:
        remaining = max(1, int((record.cooldown_until - now).total_seconds() + 0.999))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many sign-in attempts. Please try again shortly.",
                "code": "IP_RATE_LIMIT",
                "cooldown_seconds": remaining,
            },
        )
