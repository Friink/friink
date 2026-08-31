from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
import uuid

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import get_settings
from app.db import get_session_factory
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.routers.auth import REFRESH_COOKIE_NAME
from app.services.session_service import hash_refresh_token


def _rows(user_id: uuid.UUID) -> list[RefreshToken]:
    with get_session_factory()() as session:
        return session.execute(select(RefreshToken).where(RefreshToken.user_id == user_id).order_by(RefreshToken.created_at)).scalars().all()


def _delete_user(user_id: uuid.UUID) -> None:
    with get_session_factory()() as session:
        session.execute(delete(User).where(User.id == user_id))
        session.commit()


def _login(client: TestClient, email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    refresh_token = client.cookies.get(REFRESH_COOKIE_NAME)
    assert refresh_token
    return refresh_token


def test_refresh_rotation_reuse_logout_legacy_and_concurrency() -> None:
    suffix = uuid.uuid4().hex
    email = f"session-{suffix}@example.com"
    username = f"session_{suffix[:24]}"
    password = "Strong-password-9!"
    client = TestClient(app)
    user_id: uuid.UUID | None = None

    try:
        signup = client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Session Test",
                "password": password,
                "date_of_birth": "1990-01-01",
            },
        )
        assert signup.status_code == 201, signup.text
        user_id = uuid.UUID(signup.json()["id"])

        old_token = _login(client, email, password)
        rows = _rows(user_id)
        assert len(rows) == 1
        old_row = rows[0]
        first_family = old_row.family_id

        rotated = client.post("/auth/refresh")
        assert rotated.status_code == 200, rotated.text
        new_token = client.cookies.get(REFRESH_COOKIE_NAME)
        assert new_token and new_token != old_token
        rows = _rows(user_id)
        assert len(rows) == 2
        old_row = next(row for row in rows if row.family_id == first_family and row.token_hash != rows[-1].token_hash)
        new_row = next(row for row in rows if row.id == old_row.replaced_by_id)
        assert old_row.rotated_at is not None
        assert old_row.replaced_by_id == new_row.id
        assert new_row.rotated_at is None and new_row.revoked_at is None

        old_client = TestClient(app)
        old_client.cookies.set(REFRESH_COOKIE_NAME, old_token)
        reused = old_client.post("/auth/refresh")
        assert reused.status_code == 401, reused.text
        family_rows = [row for row in _rows(user_id) if row.family_id == first_family]
        assert family_rows and all(row.revoked_at is not None for row in family_rows)

        logout_token = _login(client, email, password)
        logout_rows = _rows(user_id)
        logout_row = next(row for row in logout_rows if row.token_hash != old_row.token_hash and row.token_hash != new_row.token_hash and row.revoked_at is None)
        logged_out = client.post("/auth/logout")
        assert logged_out.status_code == 204
        assert f"{REFRESH_COOKIE_NAME}=" in logged_out.headers.get("set-cookie", "")
        logout_row = next(row for row in _rows(user_id) if row.id == logout_row.id)
        assert logout_row.revoked_at is not None
        assert logout_row.revocation_reason == "logout"
        assert logout_token

        legacy = TestClient(app)
        legacy_token = jwt.encode(
            {
                "sub": str(user_id),
                "typ": "refresh",
                "iat": int(datetime.now(UTC).timestamp()),
                "exp": int((datetime.now(UTC) + timedelta(days=14)).timestamp()),
            },
            get_settings().jwt_secret_key,
            algorithm=get_settings().jwt_algorithm,
        )
        legacy.cookies.set(REFRESH_COOKIE_NAME, legacy_token)
        legacy_response = legacy.post("/auth/refresh")
        assert legacy_response.status_code == 401

        concurrent_token = _login(client, email, password)

        def refresh_with_same_cookie() -> int:
            concurrent_client = TestClient(app)
            concurrent_client.cookies.set(REFRESH_COOKIE_NAME, concurrent_token)
            return concurrent_client.post("/auth/refresh").status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(lambda _: refresh_with_same_cookie(), range(2)))
        assert sorted(statuses) == [200, 401]
        concurrent_rows = _rows(user_id)
        concurrent_family = next(row.family_id for row in concurrent_rows if row.token_hash == hash_refresh_token(concurrent_token))
        assert sum(row.family_id == concurrent_family and row.rotated_at is None and row.revoked_at is None for row in concurrent_rows) == 0
    finally:
        if user_id is not None:
            _delete_user(user_id)
