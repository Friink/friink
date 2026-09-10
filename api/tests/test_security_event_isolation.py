import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.db import get_session_factory
from app.models.user import User
from app.routers.auth import REFRESH_COOKIE_NAME


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
        refresh_token = login.cookies.get(REFRESH_COOKIE_NAME) or client.cookies.get(REFRESH_COOKIE_NAME)
        assert refresh_token
        refresh = client.post("/auth/refresh", cookies={REFRESH_COOKIE_NAME: refresh_token})
        assert refresh.status_code == 200, refresh.text
        logout = client.post("/auth/logout")
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
        stale_token = signup.cookies.get(REFRESH_COOKIE_NAME) or client.cookies.get(REFRESH_COOKIE_NAME)
        assert stale_token
        assert client.post("/auth/refresh", cookies={REFRESH_COOKIE_NAME: stale_token}).status_code == 200

        def fail_audit(*args, **kwargs):
            raise AssertionError("synthetic audit assertion")

        monkeypatch.setattr("app.services.security_events.record_security_event", fail_audit)
        grace = TestClient(app)
        grace.cookies.set(REFRESH_COOKIE_NAME, stale_token)
        assert grace.post("/auth/refresh").status_code == 200
        reuse = TestClient(app)
        reuse.cookies.set(REFRESH_COOKIE_NAME, stale_token)
        response = reuse.post("/auth/refresh")
        assert response.status_code == 401, response.text
    finally:
        _cleanup(email)
