import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from starlette.responses import Response

from api.index import app
from app.config import Settings
from app.routers.auth import REFRESH_COOKIE_NAME, set_refresh_cookie


def test_production_refresh_cookie_is_persistent_and_cross_site_safe() -> None:
    response = Response()
    settings = Settings(
        _env_file=None,
        JWT_SECRET_KEY="phase1-test-secret",
        ENVIRONMENT="production",
        FRONTEND_URL="https://staging.friink.com",
        REFRESH_TOKEN_EXPIRE_DAYS=30,
    )

    set_refresh_cookie(response, "test-refresh-token", settings)

    header = response.headers["set-cookie"]
    assert f"{REFRESH_COOKIE_NAME}=test-refresh-token" in header
    assert "Path=/" in header
    assert "Max-Age=2592000" in header
    assert "Secure" in header
    assert "HttpOnly" in header
    assert "SameSite=none" in header
    assert "Domain=" not in header


def test_auth_origin_contract_allows_configured_origin_and_rejects_cross_site() -> None:
    client = TestClient(app)
    email = f"phase1-{uuid.uuid4().hex}@example.com"
    payload = {
        "email": email,
        "username": f"phase1_{uuid.uuid4().hex[:20]}",
        "display_name": "Phase 1 Contract",
        "password": "Strong-pass9!",
        "date_of_birth": "1990-01-01",
    }
    allowed = None
    try:
        allowed = client.post("/auth/signup", headers={"Origin": "http://localhost:3000"}, json=payload)
        assert allowed.status_code == 201, allowed.text

        rejected = client.post(
            "/auth/login",
            headers={"Origin": "https://evil.example"},
            json={"email": email, "password": payload["password"]},
        )
        assert rejected.status_code == 403, rejected.text
    finally:
        if allowed.status_code == 201:
            from app.db import get_session_factory
            from app.models.user import User
            from sqlalchemy import delete

            with get_session_factory()() as session:
                user_id = session.execute(select(User.id).where(User.email == email)).scalar_one_or_none()
                if user_id:
                    session.execute(delete(User).where(User.id == user_id))
                session.commit()
