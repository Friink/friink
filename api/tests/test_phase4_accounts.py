import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.user import User
from app.services.security import hash_password


def _settings(**overrides) -> Settings:
    values = dict(_env_file=None, JWT_SECRET_KEY="phase4-account-test-secret", ENVIRONMENT="test", FRONTEND_URL="http://localhost:3000", LOGIN_RISK_OTP_ENABLED=False)
    values.update(overrides)
    return Settings(**values)


def test_multiple_account_slots_switch_refresh_and_remove() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings()
    password = "Strong1!pass"
    users = []
    emails = []
    for label in ("one", "two"):
        user_id = uuid.uuid4()
        users.append(user_id)
        email = f"phase4-{label}-{uuid.uuid4().hex}@example.com"
        username = f"phase4_{label}_{uuid.uuid4().hex[:12]}"
        emails.append(email)
        with get_session_factory()() as session:
            session.add(User(id=user_id, email=email, username=username, username_key=username.casefold(), password_hash=hash_password(password), date_of_birth=date(1990, 1, 1), is_verified=True))
            session.commit()
    try:
        client = TestClient(app)
        with get_session_factory()() as session:
            seeded = session.query(User).filter(User.id.in_(users)).order_by(User.email).all()
        first = client.post("/auth/login", json={"identifier": emails[0], "password": password})
        assert first.status_code == 200, first.text
        first_json = first.json()
        first_slot = first_json["account_slot"]
        second = client.post(
            "/auth/login",
            json={"identifier": seeded[1].email, "password": password},
            headers={"X-Friink-Account-Flow": "add-account"},
        )
        assert second.status_code == 200, second.text
        second_json = second.json()
        second_slot = second_json["account_slot"]
        assert first_slot != second_slot
        assert "friink_refresh_token=" not in second.headers.get("set-cookie", "")
        accounts = client.get("/auth/accounts", headers={"Authorization": f"Bearer {second_json['access_token']}", "X-Friink-Account-Slot": second_slot})
        assert accounts.status_code == 200, accounts.text
        assert {item["account_slot"] for item in accounts.json()} == {first_slot, second_slot}
        assert [item["account_slot"] for item in accounts.json() if item["active"]] == [second_slot]
        switched = client.post("/auth/accounts/switch", json={"account_slot": first_slot}, headers={"Authorization": f"Bearer {second_json['access_token']}", "X-Friink-Account-Slot": second_slot})
        assert switched.status_code == 200, switched.text
        assert switched.json()["user"]["email"] == seeded[0].email
        refreshed = client.post("/auth/refresh", headers={"X-Friink-Account-Slot": first_slot})
        assert refreshed.status_code == 200, refreshed.text
        removed = client.delete(f"/auth/accounts/{second_slot}", headers={"Authorization": f"Bearer {first_json['access_token']}", "X-Friink-Account-Slot": first_slot})
        assert removed.status_code == 204, removed.text
        remaining = client.get("/auth/accounts", headers={"Authorization": f"Bearer {switched.json()['access_token']}", "X-Friink-Account-Slot": first_slot})
        assert [item["account_slot"] for item in remaining.json()] == [first_slot]
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_(users)))
            session.commit()
        app.dependency_overrides.clear()


def test_new_device_login_can_be_approved_from_existing_session(monkeypatch) -> None:
    app.dependency_overrides[get_settings] = lambda: _settings(LOGIN_RISK_OTP_ENABLED=False)
    password = "Strong1!pass"
    email = f"phase4d-{uuid.uuid4().hex}@example.com"
    username = f"phase4d_{uuid.uuid4().hex[:14]}"
    user_id = uuid.uuid4()
    with get_session_factory()() as session:
        session.add(User(id=user_id, email=email, username=username, username_key=username.casefold(), password_hash=hash_password(password), date_of_birth=date(1990, 1, 1), is_verified=True))
        session.commit()
    async def capture_code(self, email: str, otp_code: str) -> None:
        return None
    monkeypatch.setattr("app.services.email.EmailService.send_login_otp", capture_code)
    try:
        existing = TestClient(app)
        logged_in = existing.post("/auth/login", json={"identifier": email, "password": password})
        assert logged_in.status_code == 200
        app.dependency_overrides[get_settings] = lambda: _settings(LOGIN_RISK_OTP_ENABLED=True, RESEND_API_KEY="test-key")
        new_device = TestClient(app)
        challenged = new_device.post("/auth/login", json={"identifier": email, "password": password})
        assert challenged.status_code == 200 and challenged.json()["challenge_required"] is True
        pending = existing.get("/auth/login/pending", headers={"Authorization": f"Bearer {logged_in.json()['access_token']}"})
        assert pending.status_code == 200 and pending.json()
        challenge_id = pending.json()[0]["challenge_id"]
        notifications = existing.get("/notifications", headers={"Authorization": f"Bearer {logged_in.json()['access_token']}"})
        assert notifications.status_code == 200
        assert any(item["payload"].get("kind") == "login_approval" for item in notifications.json()["items"])
        approved = existing.post("/auth/login/approve", json={"challenge_id": challenge_id}, headers={"Authorization": f"Bearer {logged_in.json()['access_token']}"})
        assert approved.status_code == 204
        completed = new_device.post("/auth/login/complete-approved", json={"challenge_token": challenged.json()["challenge_token"], "otp": "000000"})
        assert completed.status_code == 200, completed.text
        assert completed.json()["user"]["email"] == email

        denied_device = TestClient(app)
        denied = denied_device.post("/auth/login", json={"identifier": email, "password": password})
        assert denied.status_code == 200 and denied.json()["challenge_required"] is True
        pending_after = existing.get("/auth/login/pending", headers={"Authorization": f"Bearer {logged_in.json()['access_token']}"})
        assert pending_after.status_code == 200 and pending_after.json()
        denied_id = pending_after.json()[0]["challenge_id"]
        assert existing.post("/auth/login/deny", json={"challenge_id": denied_id}, headers={"Authorization": f"Bearer {logged_in.json()['access_token']}"}).status_code == 204
        rejected_otp = denied_device.post("/auth/login/verify", json={"challenge_token": denied.json()["challenge_token"], "otp": "000000"})
        assert rejected_otp.status_code == 400
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id == user_id))
            session.commit()
        app.dependency_overrides.clear()
