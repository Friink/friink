from datetime import UTC, datetime, timedelta
from typing import Any
import uuid

import bcrypt
import jwt

from app.config import get_settings
from app.services.auth_errors import AuthErrorCode


class TokenValidationError(Exception):
    def __init__(self, code: AuthErrorCode, message: str, *, original: Exception | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.original = original


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_token(user_id: uuid.UUID, token_type: str, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(
        payload,
        settings.jwt_signing_key,
        algorithm=settings.jwt_algorithm,
        headers={"kid": settings.jwt_active_kid},
    )


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    return create_token(user_id, "access", timedelta(minutes=settings.access_token_expire_minutes))


def classify_jwt_error(error: jwt.PyJWTError) -> AuthErrorCode:
    if isinstance(error, jwt.ExpiredSignatureError):
        return AuthErrorCode.TOKEN_EXPIRED
    if isinstance(error, jwt.InvalidSignatureError):
        return AuthErrorCode.TOKEN_SIGNATURE_MISMATCH
    if isinstance(error, jwt.DecodeError):
        return AuthErrorCode.TOKEN_MALFORMED
    return AuthErrorCode.TOKEN_INVALID


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if kid is None:
            verification_key = settings.jwt_secret_key
        else:
            verification_key = settings.jwt_verification_keys.get(kid)
            if not verification_key:
                raise TokenValidationError(AuthErrorCode.TOKEN_SIGNATURE_MISMATCH, "Token key id is not configured.")
        payload = jwt.decode(token, verification_key, algorithms=[settings.jwt_algorithm])
    except TokenValidationError:
        raise
    except jwt.PyJWTError as exc:
        raise TokenValidationError(classify_jwt_error(exc), "Token validation failed.", original=exc) from exc
    if not isinstance(payload.get("sub"), str) or not payload["sub"]:
        raise TokenValidationError(AuthErrorCode.TOKEN_SCHEMA_INVALID, "Token subject is missing or invalid.")
    try:
        uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise TokenValidationError(AuthErrorCode.TOKEN_SCHEMA_INVALID, "Token subject is not a valid user id.") from exc
    if payload.get("typ") != expected_type:
        raise TokenValidationError(AuthErrorCode.TOKEN_SCHEMA_INVALID, "Token type is missing or invalid.")
    return payload
