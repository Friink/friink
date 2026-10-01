import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import get_settings
from app.db import get_session_factory
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services.session_service import hash_refresh_token


def _slot_credentials(client: TestClient, response) -> tuple[str, str, str]:
    slot = response.json()["account_slot"]
    cookie_name = f"friink_refresh_{slot}"
    token = client.cookies.get(cookie_name)
    device = client.cookies.get("friink_device_id")
    assert token and device
    return slot, token, device


def _new_identity() -> tuple[str, str, str]:
    suffix = uuid.uuid4().hex
    return f"audit-isolation-{suffix}@example.com", f"audit_{suffix[:20]}", "Strong-pass9!"


def _cleanup(email: str) -> None:
    with get_session_factory()() as session:
        user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is not None:
            session.execute(delete(User).where(User.id == user.id))
            session.commit()


def test_auth_responses_survive_audit_write_failure(monkeypatch) -> None:
    email, username, password = _new_identity()
    client = TestClient(app)
    try:
        signup = client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Audit Isolation",
                "password": password,
                "date_of_birth": "1990-01-01",
            },
        )
        assert signup.status_code == 201, signup.text

        def fail_audit(*args, **kwargs):
            raise RuntimeError("synthetic audit outage")

        monkeypatch.setattr("app.services.security_events.record_security_event", fail_audit)

        login = client.post("/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        slot, refresh_token, _device = _slot_credentials(client, login)
        refresh = client.post("/auth/refresh", headers={"X-Friink-Account-Slot": slot})
        assert refresh.status_code == 200, refresh.text
        logout = client.post("/auth/logout", headers={"X-Friink-Account-Slot": slot})
        assert logout.status_code == 204, logout.text
        failed_login = client.post("/auth/login", json={"email": email, "password": "wrong-pass9!"})
        assert failed_login.status_code == 401, failed_login.text
    finally:
        _cleanup(email)


def test_refresh_reuse_response_survives_audit_write_failure(monkeypatch) -> None:
    email, username, password = _new_identity()
    client = TestClient(app)
    try:
        signup = client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Audit Isolation",
                "password": password,
                "date_of_birth": "1990-01-01",
            },
        )
        assert signup.status_code == 201, signup.text
        slot, stale_token, device = _slot_credentials(client, signup)
        assert client.post("/auth/refresh", headers={"X-Friink-Account-Slot": slot}).status_code == 200

        def fail_audit(*args, **kwargs):
            raise AssertionError("synthetic audit assertion")

        monkeypatch.setattr("app.services.security_events.record_security_event", fail_audit)
        grace = TestClient(app)
        grace.cookies.set(f"friink_refresh_{slot}", stale_token)
        grace.cookies.set("friink_device_id", device)
        assert grace.post("/auth/refresh", headers={"X-Friink-Account-Slot": slot}).status_code == 200
        # The deterministic successor is replayable during the configured
        # grace window; age the original parent so this assertion exercises
        # post-grace reuse detection.
        with get_session_factory()() as session:
            parent = session.execute(
                select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(stale_token))
            ).scalar_one()
            parent.rotated_at = datetime.now(UTC) - timedelta(
                seconds=get_settings().refresh_token_reuse_grace_seconds + 1
            )
            session.commit()
        reuse = TestClient(app)
        reuse.cookies.set(f"friink_refresh_{slot}", stale_token)
        reuse.cookies.set("friink_device_id", device)
        response = reuse.post("/auth/refresh", headers={"X-Friink-Account-Slot": slot})
        assert response.status_code == 401, response.text
    finally:
        _cleanup(email)
