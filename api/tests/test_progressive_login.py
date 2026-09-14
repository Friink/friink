import time
import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.progressive_auth_flow import ProgressiveAuthFlow
from app.models.signup_reservation import SignupReservation
from app.models.user import User
from app.services.security import hash_password


def test_progressive_start_is_neutral_and_continue_selects_server_flow(monkeypatch) -> None:
    suffix = uuid.uuid4().hex
    existing_email = f"progressive-existing-{suffix}@example.com"
    new_email = f"progressive-new-{suffix}@example.com"
    existing_username = f"progressive_{suffix[:20]}"
    unknown_username = f"missing_{suffix[:20]}"
    admin_email = "admin@friink.com"
    admin_username = "@admin"
    existing_id = uuid.uuid4()

    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        JWT_SECRET_KEY="progressive-test-secret",
        ENVIRONMENT="development",
        FRONTEND_URL="http://localhost:3000",
        OTP_ENABLED=True,
        SIGNUP_OTP_ENABLED=True,
        LOGIN_RISK_OTP_ENABLED=True,
        RESEND_API_KEY="test-key",
        PROGRESSIVE_LOGIN_ENABLED=True,
    )

    try:
        with get_session_factory()() as session:
            session.add(User(
                id=existing_id,
                email=existing_email,
                username=existing_username,
                username_key=existing_username.casefold(),
                password_hash=hash_password("Password1!"),
                date_of_birth=date(1990, 1, 1),
                is_verified=True,
            ))
            session.commit()

        client = TestClient(app)
        starts = []
        for identifier in (existing_email, new_email, unknown_username, admin_email, admin_username):
            started_at = time.monotonic()
            response = client.post("/auth/progressive/start", json={"identifier": identifier})
            elapsed = time.monotonic() - started_at
            assert response.status_code == 202, response.text
            assert set(response.json()) == {"accepted", "flow_token", "message"}
            assert response.json()["accepted"] is True
            assert response.json()["message"] == "Continue securely."
            assert elapsed >= 0.30
            starts.append(response.json()["flow_token"])

        existing = client.post("/auth/progressive/continue", json={"flow_token": starts[0]})
        assert existing.status_code == 200, existing.text
        assert existing.json() == {"next_step": "password", "message": "Continue securely."}

        new = client.post("/auth/progressive/continue", json={"flow_token": starts[1]})
        assert new.status_code == 200, new.text
        assert new.json()["next_step"] == "email_verification"
        assert new.json()["message"] == "Continue securely."

        unknown = client.post("/auth/progressive/continue", json={"flow_token": starts[2]})
        assert unknown.status_code == 200, unknown.text
        assert unknown.json()["next_step"] == "password"

        for admin_token in starts[3:]:
            admin = client.post("/auth/progressive/continue", json={"flow_token": admin_token})
            assert admin.status_code == 200, admin.text
            assert admin.json()["next_step"] == "password"

        reused = client.post("/auth/progressive/continue", json={"flow_token": starts[0]})
        assert reused.status_code == 400, reused.text
    finally:
        app.dependency_overrides.pop(get_settings, None)
        with get_session_factory()() as session:
            session.execute(delete(ProgressiveAuthFlow).where(ProgressiveAuthFlow.identifier.in_([existing_email, new_email, unknown_username, admin_email, admin_username])))
            session.execute(delete(SignupReservation).where(SignupReservation.email == new_email))
            session.execute(delete(User).where(User.id == existing_id))
            session.commit()
