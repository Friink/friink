from datetime import UTC, date, datetime, timedelta
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.identity_history import UserEmailHistory
from app.models.user import User
from app.services.account_lifecycle import process_pending_deletions
from app.services.security import hash_password


def _settings(**overrides) -> Settings:
    values = {
        "_env_file": None,
        "JWT_SECRET_KEY": "account-lifecycle-test-secret-32-bytes",
        "ENVIRONMENT": "test",
        "FRONTEND_URL": "http://localhost:3000",
        "LOGIN_RISK_OTP_ENABLED": False,
        "RESEND_API_KEY": "test-resend-key",
    }
    values.update(overrides)
    return Settings(**values)


def _seed_user(prefix: str) -> tuple[uuid.UUID, str, str, str]:
    email = f"{prefix}-{uuid.uuid4().hex}@example.com"
    username = f"{prefix}_{uuid.uuid4().hex[:20]}"
    password = "Strong1!pass"
    user_id = uuid.uuid4()
    with get_session_factory()() as session:
        session.add(User(id=user_id, email=email, username=username, username_key=username.casefold(), password_hash=hash_password(password), date_of_birth=date(1990, 1, 1), is_verified=True))
        session.commit()
    return user_id, email, username, password


def _delete_user(user_id: uuid.UUID) -> None:
    with get_session_factory()() as session:
        session.execute(User.__table__.delete().where(User.id == user_id))
        session.commit()


def test_deactivation_revokes_access_and_reactivation_requires_otp(monkeypatch) -> None:
    codes: list[str] = []

    async def capture_code(self, email: str, otp_code: str) -> None:
        codes.append(otp_code)

    monkeypatch.setattr("app.services.email.EmailService.send_lifecycle_otp", capture_code)
    app.dependency_overrides[get_settings] = lambda: _settings()
    user_id, email, _username, password = _seed_user("lifecycle")
    client = TestClient(app)
    try:
        login = client.post("/auth/login", json={"identifier": email, "password": password})
        assert login.status_code == 200, login.text
        access_token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        deactivated = client.post("/auth/me/deactivate", headers=headers, json={"current_password": password})
        assert deactivated.status_code == 204, deactivated.text
        assert client.get("/auth/me", headers=headers).status_code == 401

        reactivation = client.post("/auth/login", json={"identifier": email, "password": password})
        assert reactivation.status_code == 200, reactivation.text
        assert reactivation.json()["lifecycle_status"] == "deactivated"
        assert codes
        restored = client.post("/auth/login/verify", json={"challenge_token": reactivation.json()["challenge_token"], "otp": codes[-1]})
        assert restored.status_code == 200, restored.text
        assert restored.json()["user"]["id"]
        with get_session_factory()() as session:
            assert session.get(User, user_id).lifecycle_status == "active"
    finally:
        _delete_user(user_id)
        app.dependency_overrides.clear()


def test_deletion_requires_otp_and_worker_retains_tombstone(monkeypatch) -> None:
    codes: list[str] = []

    async def capture_code(self, email: str, otp_code: str) -> None:
        codes.append(otp_code)

    monkeypatch.setattr("app.services.email.EmailService.send_lifecycle_otp", capture_code)
    app.dependency_overrides[get_settings] = lambda: _settings()
    user_id, email, _username, password = _seed_user("deletion")
    client = TestClient(app)
    try:
        token = client.post("/auth/login", json={"identifier": email, "password": password}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        start = client.post("/auth/me/delete/start", headers=headers, json={"current_password": password})
        assert start.status_code == 202, start.text
        assert codes
        confirmed = client.post("/auth/me/delete/confirm", headers=headers, json={"challenge_token": start.json()["challenge_token"], "otp": codes[-1]})
        assert confirmed.status_code == 204, confirmed.text

        with get_session_factory()() as session:
            user = session.get(User, user_id)
            assert user
            user.deletion_deadline = datetime.now(UTC) - timedelta(minutes=1)
            original_email = user.email
            session.commit()
            processed = process_pending_deletions(session, _settings(), now=datetime.now(UTC))
            assert processed == 1
            deleted = session.get(User, user_id)
            assert deleted
            assert deleted.lifecycle_status == "deleted"
            assert deleted.email != original_email
            assert session.execute(select(UserEmailHistory).where(UserEmailHistory.user_id == user_id)).first()
    finally:
        _delete_user(user_id)
        app.dependency_overrides.clear()
