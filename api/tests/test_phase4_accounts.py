import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.auth_session import AuthSession
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
        assert f"friink_refresh_{first_slot}=" in switched.headers.get("set-cookie", "")
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


def test_active_slot_logout_revokes_slot_and_allows_readd() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings()
    password = "Strong1!pass"
    users = []
    emails = []
    for label in ("one", "two"):
        user_id = uuid.uuid4()
        users.append(user_id)
        email = f"phase4-logout-{label}-{uuid.uuid4().hex}@example.com"
        username = f"phase4_logout_{label}_{uuid.uuid4().hex[:12]}"
        emails.append(email)
        with get_session_factory()() as session:
            session.add(User(id=user_id, email=email, username=username, username_key=username.casefold(), password_hash=hash_password(password), date_of_birth=date(1990, 1, 1), is_verified=True))
            session.commit()
    try:
        client = TestClient(app)
        first = client.post("/auth/login", json={"identifier": emails[0], "password": password})
        second = client.post("/auth/login", json={"identifier": emails[1], "password": password}, headers={"X-Friink-Account-Flow": "add-account"})
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        first_json = first.json()
        second_json = second.json()
        first_slot = first_json["account_slot"]
        second_slot = second_json["account_slot"]

        logged_out = client.post("/auth/logout", headers={"X-Friink-Account-Slot": second_slot})
        assert logged_out.status_code == 204, logged_out.text
        remaining = client.get("/auth/accounts", headers={"Authorization": f"Bearer {first_json['access_token']}", "X-Friink-Account-Slot": first_slot})
        assert remaining.status_code == 200, remaining.text
        assert [item["account_slot"] for item in remaining.json()] == [first_slot]

        readded = client.post("/auth/login", json={"identifier": emails[1], "password": password}, headers={"X-Friink-Account-Flow": "add-account"})
        assert readded.status_code == 200, readded.text
        readded_slot = readded.json()["account_slot"]
        assert readded_slot != second_slot
        final_accounts = client.get("/auth/accounts", headers={"Authorization": f"Bearer {readded.json()['access_token']}", "X-Friink-Account-Slot": readded_slot})
        assert final_accounts.status_code == 200, final_accounts.text
        assert {item["username"] for item in final_accounts.json()} == {item["username"] for item in [first.json()["user"], readded.json()["user"]]}
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_(users)))
            session.commit()
        app.dependency_overrides.clear()


def test_add_account_without_device_cookie_fails_without_creating_a_slot() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings()
    password = "Strong1!pass"
    user_id = uuid.uuid4()
    email = f"phase4-cookie-{uuid.uuid4().hex}@example.com"
    username = f"phase4_cookie_{uuid.uuid4().hex[:12]}"
    with get_session_factory()() as session:
        session.add(User(id=user_id, email=email, username=username, username_key=username.casefold(), password_hash=hash_password(password), date_of_birth=date(1990, 1, 1), is_verified=True))
        session.commit()
    try:
        client = TestClient(app)
        response = client.post("/auth/login", json={"identifier": email, "password": password}, headers={"X-Friink-Account-Flow": "add-account"})
        assert response.status_code == 409, response.text
        with get_session_factory()() as session:
            assert session.query(AuthSession).filter(AuthSession.user_id == user_id).count() == 0
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id == user_id))
            session.commit()
        app.dependency_overrides.clear()


def test_three_account_logout_and_readd_sequence_preserves_all_slots() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings()
    password = "Strong1!pass"
    users = []
    accounts = []
    for label in ("one", "two", "three"):
        user_id = uuid.uuid4()
        email = f"phase4-sequence-{label}-{uuid.uuid4().hex}@example.com"
        username = f"phase4_sequence_{label}_{uuid.uuid4().hex[:12]}"
        users.append(user_id)
        accounts.append((email, username))
        with get_session_factory()() as session:
            session.add(User(id=user_id, email=email, username=username, username_key=username.casefold(), password_hash=hash_password(password), date_of_birth=date(1990, 1, 1), is_verified=True))
            session.commit()
    try:
        client = TestClient(app)

        first = client.post("/auth/login", json={"identifier": accounts[0][0], "password": password})
        assert first.status_code == 200, first.text
        first_json = first.json()

        added_second = client.post(
            "/auth/login",
            json={"identifier": accounts[1][0], "password": password},
            headers={"X-Friink-Account-Flow": "add-account"},
        )
        assert added_second.status_code == 200, added_second.text
        second_json = added_second.json()

        logged_out_second = client.post("/auth/logout", headers={"X-Friink-Account-Slot": second_json["account_slot"]})
        assert logged_out_second.status_code == 204, logged_out_second.text
        logged_out_second_again = client.post("/auth/logout", headers={"X-Friink-Account-Slot": second_json["account_slot"]})
        assert logged_out_second_again.status_code == 204, logged_out_second_again.text

        third = client.post("/auth/login", json={"identifier": accounts[2][0], "password": password})
        assert third.status_code == 200, third.text
        third_json = third.json()
        logged_out_third = client.post("/auth/logout", headers={"X-Friink-Account-Slot": third_json["account_slot"]})
        assert logged_out_third.status_code == 204, logged_out_third.text

        relogged_first = client.post("/auth/login", json={"identifier": accounts[0][0], "password": password})
        assert relogged_first.status_code == 200, relogged_first.text
        relogged_first_json = relogged_first.json()

        readded_second = client.post(
            "/auth/login",
            json={"identifier": accounts[1][0], "password": password},
            headers={"X-Friink-Account-Flow": "add-account"},
        )
        assert readded_second.status_code == 200, readded_second.text
        readded_second_json = readded_second.json()

        readded_third = client.post(
            "/auth/login",
            json={"identifier": accounts[2][0], "password": password},
            headers={"X-Friink-Account-Flow": "add-account"},
        )
        assert readded_third.status_code == 200, readded_third.text
        readded_third_json = readded_third.json()

        listed = client.get(
            "/auth/accounts",
            headers={
                "Authorization": f"Bearer {readded_third_json['access_token']}",
                "X-Friink-Account-Slot": readded_third_json["account_slot"],
            },
        )
        assert listed.status_code == 200, listed.text
        assert {item["username"] for item in listed.json()} == {username for _, username in accounts}

        switched = client.post(
            "/auth/accounts/switch",
            json={"account_slot": relogged_first_json["account_slot"]},
            headers={
                "Authorization": f"Bearer {readded_third_json['access_token']}",
                "X-Friink-Account-Slot": readded_third_json["account_slot"],
            },
        )
        assert switched.status_code == 200, switched.text
        assert switched.json()["user"]["email"] == accounts[0][0]
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_(users)))
            session.commit()
        app.dependency_overrides.clear()
