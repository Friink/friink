from datetime import UTC, datetime, timedelta
import uuid

import jwt
import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.services.auth_errors import AuthErrorCode
from app.services.security import TokenValidationError, create_access_token, decode_token


def configure_jwt_secret(monkeypatch: pytest.MonkeyPatch, secret: str = "test-secret-at-least-32-bytes-long") -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", secret)
    get_settings.cache_clear()


def make_token(secret: str, payload: dict[str, object]) -> str:
    return jwt.encode(payload, secret, algorithm="HS256")


def test_missing_jwt_secret_fails_settings_load(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    get_settings.cache_clear()

    with pytest.raises(ValidationError):
        Settings()


def test_expired_token_is_classified(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "test-secret-at-least-32-bytes-long"
    configure_jwt_secret(monkeypatch, secret)
    now = datetime.now(UTC)
    token = make_token(
        secret,
        {
            "sub": str(uuid.uuid4()),
            "typ": "access",
            "iat": int((now - timedelta(hours=2)).timestamp()),
            "exp": int((now - timedelta(hours=1)).timestamp()),
        },
    )

    with pytest.raises(TokenValidationError) as error:
        decode_token(token, "access")

    assert error.value.code == AuthErrorCode.TOKEN_EXPIRED


def test_malformed_token_is_classified(monkeypatch: pytest.MonkeyPatch) -> None:
    configure_jwt_secret(monkeypatch)

    with pytest.raises(TokenValidationError) as error:
        decode_token("not-a-jwt", "access")

    assert error.value.code == AuthErrorCode.TOKEN_MALFORMED


def test_wrong_secret_token_is_classified(monkeypatch: pytest.MonkeyPatch) -> None:
    configure_jwt_secret(monkeypatch, "current-secret-at-least-32-bytes")
    now = datetime.now(UTC)
    token = make_token(
        "old-secret-at-least-32-bytes-long",
        {
            "sub": str(uuid.uuid4()),
            "typ": "access",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=30)).timestamp()),
        },
    )

    with pytest.raises(TokenValidationError) as error:
        decode_token(token, "access")

    assert error.value.code == AuthErrorCode.TOKEN_SIGNATURE_MISMATCH


def test_valid_token_survives_unrelated_schema_changes(monkeypatch: pytest.MonkeyPatch) -> None:
    configure_jwt_secret(monkeypatch)
    user_id = uuid.uuid4()
    token = create_access_token(user_id)

    payload = decode_token(token, "access")

    assert payload["sub"] == str(user_id)
    assert set(payload) == {"sub", "typ", "iat", "exp"}
