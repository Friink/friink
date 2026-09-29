from datetime import UTC, datetime, timedelta
import time
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
from app.models.security_event import SecurityEvent, SecurityEventType
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


def test_refresh_rotation_reuse_logout_legacy(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "refresh_token_reuse_grace_seconds", 1)
    suffix = uuid.uuid4().hex
    email = f"session-{suffix}@example.com"
    username = f"session_{suffix[:24]}"
    password = "Strong-pass9!"
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
        with get_session_factory()() as session:
            user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()

        old_token = client.cookies.get(REFRESH_COOKIE_NAME)
        assert old_token
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
        assert repeated_reuse.status_code == 200, repeated_reuse.text
        assert repeated_reuse.cookies.get(REFRESH_COOKIE_NAME) == new_token

        with get_session_factory()() as session:
            parent = session.get(RefreshToken, old_row.id)
            assert parent
            parent.rotated_at = datetime.now(UTC) - timedelta(seconds=2)
            session.commit()

        duplicate_reuse_client = TestClient(app)
        duplicate_reuse_client.cookies.set(REFRESH_COOKIE_NAME, old_token)
        duplicate_reuse = duplicate_reuse_client.post("/auth/refresh")
        assert duplicate_reuse.status_code == 401, duplicate_reuse.text
        with get_session_factory()() as session:
            reuse_events = session.execute(select(SecurityEvent).where(SecurityEvent.user_id == user_id, SecurityEvent.event_type == SecurityEventType.refresh_reuse_detected)).scalars().all()
            assert len(reuse_events) == 1
            assert reuse_events[0].event_key == f"refresh-reuse:{old_row.id}"
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


def test_refresh_retries_reuse_one_deterministic_child(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "refresh_token_reuse_grace_seconds", 1)
    suffix = uuid.uuid4().hex
    email = f"refresh-retry-{suffix}@example.com"
    username = f"retry_{suffix[:24]}"
    password = "Strong-pass9!"
    signup_client = TestClient(app)
    user_id: uuid.UUID | None = None

    try:
        signup = signup_client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Refresh Retry Test",
                "password": password,
                "date_of_birth": "1990-01-01",
            },
        )
        assert signup.status_code == 201, signup.text
        old_token = signup_client.cookies.get(REFRESH_COOKIE_NAME)
        assert old_token
        with get_session_factory()() as session:
            user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()
        original_row = _rows(user_id)[0]
        operation_id = f"test-{uuid.uuid4().hex}"

        first_client = TestClient(app)
        first_client.cookies.set(REFRESH_COOKIE_NAME, old_token)
        first = first_client.post(
            "/auth/refresh",
            headers={"X-Friink-Refresh-Operation-Id": operation_id},
        )
        assert first.status_code == 200, first.text
        assert set(first.json()) == {"access_token", "token_type", "account_slot"}
        replacement = first.cookies.get(REFRESH_COOKIE_NAME)
        assert replacement and replacement != old_token

        # A same-operation retry must recover the committed child even after
        # the ordinary grace period, if that child is still the active token.
        with get_session_factory()() as session:
            parent = session.get(RefreshToken, original_row.id)
            assert parent
            parent.rotated_at = datetime.now(UTC) - timedelta(seconds=2)
            session.commit()

        retry_client = TestClient(app)
        retry_client.cookies.set(REFRESH_COOKIE_NAME, old_token)
        retry = retry_client.post(
            "/auth/refresh",
            headers={"X-Friink-Refresh-Operation-Id": operation_id},
        )
        assert retry.status_code == 200, retry.text
        assert retry.cookies.get(REFRESH_COOKIE_NAME) == replacement
        assert next(row for row in _rows(user_id) if row.id == original_row.id).reuse_grace_used_at is None

        # Separate tabs can create distinct operation IDs for the same stale
        # cookie during the grace window. They must all receive the same child,
        # rather than revoking it and issuing competing replacements.
        for retry_operation_id in (f"test-{uuid.uuid4().hex}", f"test-{uuid.uuid4().hex}"):
            with get_session_factory()() as session:
                parent = session.get(RefreshToken, original_row.id)
                assert parent
                parent.rotated_at = datetime.now(UTC)
                session.commit()

            retry_client = TestClient(app)
            retry_client.cookies.set(REFRESH_COOKIE_NAME, old_token)
            retry = retry_client.post(
                "/auth/refresh",
                headers={"X-Friink-Refresh-Operation-Id": retry_operation_id},
            )
            assert retry.status_code == 200, retry.text
            assert retry.cookies.get(REFRESH_COOKIE_NAME) == replacement

        rows = [row for row in _rows(user_id) if row.family_id == original_row.family_id]
        active_rows = [row for row in rows if row.revoked_at is None and row.rotated_at is None]
        updated_parent = next(row for row in rows if row.id == original_row.id)
        assert len(rows) == 2
        assert len(active_rows) == 1
        assert updated_parent.rotation_operation_id == operation_id
        assert updated_parent.reuse_grace_used_at is not None
        assert active_rows[0].derivation_key_id

        # Replay detection remains active after grace for a different
        # operation ID, even when the parent has a deterministic successor.
        with get_session_factory()() as session:
            parent = session.get(RefreshToken, original_row.id)
            assert parent
            parent.rotated_at = datetime.now(UTC) - timedelta(seconds=2)
            session.commit()
        unrelated_retry = TestClient(app)
        unrelated_retry.cookies.set(REFRESH_COOKIE_NAME, old_token)
        rejected = unrelated_retry.post(
            "/auth/refresh",
            headers={"X-Friink-Refresh-Operation-Id": f"test-{uuid.uuid4().hex}"},
        )
        assert rejected.status_code == 401, rejected.text
        assert rejected.json()["detail"]["code"] == "REFRESH_TOKEN_INVALID"
        assert all(row.revoked_at is not None for row in _rows(user_id) if row.family_id == original_row.family_id)
    finally:
        if user_id is not None:
            _delete_user(user_id)


def test_one_second_access_token_expiry_refreshes_successfully(monkeypatch) -> None:
    """Exercise access expiry and refresh using a test-only one-second JWT."""
    settings = get_settings()
    monkeypatch.setattr(settings, "access_token_expire_minutes", 1 / 60)
    monkeypatch.setattr(settings, "jwt_clock_skew_seconds", 0)

    suffix = uuid.uuid4().hex
    email = f"one-second-expiry-{suffix}@example.com"
    username = f"one_sec_{suffix[:20]}"
    password = "Strong-pass9!"
    client = TestClient(app)
    user_id: uuid.UUID | None = None

    try:
        signup = client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Short Expiry Test",
                "password": password,
                "date_of_birth": "1990-01-01",
            },
        )
        assert signup.status_code == 201, signup.text
        access_token = signup.json()["access_token"]
        refresh_token = client.cookies.get(REFRESH_COOKIE_NAME)
        assert refresh_token

        with get_session_factory()() as session:
            user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()

        valid = client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert valid.status_code == 200, valid.text

        # JWT exp is encoded to whole seconds, so wait beyond each one-second
        # lifetime and assert expiration with clock skew disabled above.
        for _ in range(3):
            time.sleep(2)
            expired = client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
            assert expired.status_code == 401, expired.text

            # Seed a fresh client's cookie jar with the latest refresh value so
            # the API sees the same rotation chain after every expiry.
            refresh_client = TestClient(app)
            refresh_client.cookies.set(REFRESH_COOKIE_NAME, refresh_token)
            refreshed = refresh_client.post("/auth/refresh")
            assert refreshed.status_code == 200, refreshed.text
            next_refresh_token = refreshed.cookies.get(REFRESH_COOKIE_NAME)
            assert next_refresh_token and next_refresh_token != refresh_token
            access_token = refreshed.json()["access_token"]
            restored = refresh_client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert restored.status_code == 200, restored.text
            refresh_token = next_refresh_token
    finally:
        if user_id is not None:
            _delete_user(user_id)


def test_session_management_lists_current_and_revokes_independently() -> None:
    suffix = uuid.uuid4().hex
    email = f"managed-session-{suffix}@example.com"
    username = f"managed_session_{suffix[:15]}"
    password = "Strong-pass9!"
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
        with get_session_factory()() as session:
            user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()

        first_client = signup_client
        first_login = signup
        second_client = TestClient(app)
        second_login = second_client.post("/auth/login", json={"email": email, "password": password})
        assert first_login.status_code == 201
        assert second_login.status_code == 200
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
