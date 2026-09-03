from datetime import UTC, datetime, timedelta
import uuid

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import get_settings
from app.db import get_session_factory
from app.models.refresh_token import RefreshToken
from app.models.auth_session import AuthSession
from app.models.user import User
from app.routers.auth import REFRESH_COOKIE_NAME


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


def test_refresh_rotation_reuse_logout_legacy() -> None:
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
        assert reused.status_code == 200, reused.text
        repeated_client = TestClient(app)
        repeated_client.cookies.set(REFRESH_COOKIE_NAME, old_token)
        repeated_reuse = repeated_client.post("/auth/refresh")
        assert repeated_reuse.status_code == 401, repeated_reuse.text
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

    finally:
        if user_id is not None:
            _delete_user(user_id)


def test_session_management_lists_current_and_revokes_independently() -> None:
    suffix = uuid.uuid4().hex
    email = f"managed-session-{suffix}@example.com"
    username = f"managed_session_{suffix[:22]}"
    password = "Strong-password-9!"
    signup_client = TestClient(app)
    user_id: uuid.UUID | None = None

    try:
        signup = signup_client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Managed Session Test",
                "password": password,
                "date_of_birth": "1990-01-01",
            },
        )
        assert signup.status_code == 201, signup.text
        user_id = uuid.UUID(signup.json()["id"])

        first_client = TestClient(app)
        first_login = first_client.post("/auth/login", json={"email": email, "password": password})
        second_client = TestClient(app)
        second_login = second_client.post("/auth/login", json={"email": email, "password": password})
        assert first_login.status_code == second_login.status_code == 200
        first_access = first_login.json()["access_token"]
        second_access = second_login.json()["access_token"]

        listed = first_client.get("/auth/sessions", headers={"Authorization": f"Bearer {first_access}"})
        assert listed.status_code == 200, listed.text
        sessions = listed.json()
        assert len(sessions) == 2
        assert sum(item["current"] for item in sessions) == 1
        first_session_id = next(item["id"] for item in sessions if item["current"])
        other_session_id = next(item["id"] for item in sessions if not item["current"])
        assert all(item["device_label"] for item in sessions)

        revoked = first_client.post(f"/auth/sessions/{other_session_id}/revoke", headers={"Authorization": f"Bearer {first_access}"})
        assert revoked.status_code == 204, revoked.text
        second_refresh = second_client.post("/auth/refresh")
        assert second_refresh.status_code == 401, second_refresh.text

        remaining = first_client.get("/auth/sessions", headers={"Authorization": f"Bearer {first_access}"})
        assert remaining.status_code == 200
        assert [item["id"] for item in remaining.json()] == [first_session_id]
        assert remaining.json()[0]["current"] is True

        third_client = TestClient(app)
        third_login = third_client.post("/auth/login", json={"email": email, "password": password})
        assert third_login.status_code == 200
        revoked_others = first_client.post("/auth/sessions/revoke-others", headers={"Authorization": f"Bearer {first_access}"})
        assert revoked_others.status_code == 204, revoked_others.text
        assert third_client.post("/auth/refresh").status_code == 401
        assert first_client.get("/auth/sessions", headers={"Authorization": f"Bearer {first_access}"}).json()[0]["current"] is True
        assert second_access
    finally:
        if user_id is not None:
            _delete_user(user_id)
