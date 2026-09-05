import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.auth_challenge import LoginChallenge
from app.models.otp import OtpCode
from app.models.signup_reservation import SignupReservation
from app.models.user import User
from app.services.auth import purge_expired_signup_reservations
from app.services.security import hash_password


def _settings(**overrides) -> Settings:
    values = {
        "_env_file": None,
        "JWT_SECRET_KEY": "phase2-auth-flow-test-secret-32-bytes",
        "ENVIRONMENT": "test",
        "FRONTEND_URL": "http://localhost:3000",
        "LOGIN_RISK_OTP_ENABLED": False,
        "RESEND_API_KEY": "",
    }
    values.update(overrides)
    return Settings(**values)


def _seed_user(email: str, username: str, password: str, **values) -> uuid.UUID:
    user_id = uuid.uuid4()
    with get_session_factory()() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                username=username,
                username_key=username.casefold(),
                password_hash=hash_password(password),
                date_of_birth=date(1990, 1, 1),
                is_verified=True,
                **values,
            )
        )
        session.commit()
    return user_id


def _delete_user(user_id: uuid.UUID) -> None:
    with get_session_factory()() as session:
        session.execute(delete(User).where(User.id == user_id))
        session.commit()


def test_risk_login_challenges_new_changed_and_recognized_devices(monkeypatch) -> None:
    codes: list[str] = []

    async def capture_code(self, email: str, otp_code: str) -> None:
        codes.append(otp_code)

    monkeypatch.setattr("app.services.email.EmailService.send_login_otp", capture_code)
    app.dependency_overrides[get_settings] = lambda: _settings(
        LOGIN_RISK_OTP_ENABLED=True,
        RESEND_API_KEY="test-resend-key",
    )
    password = "Strong1!pass"
    email = f"risk-{uuid.uuid4().hex}@example.com"
    user_id = _seed_user(email, f"risk_{uuid.uuid4().hex[:20]}", password)
    try:
        client = TestClient(app)
        chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        firefox_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
        safari_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15"
        first = client.post("/auth/login", json={"identifier": email, "password": password}, headers={"user-agent": chrome_ua})
        assert first.status_code == 200, first.text
        assert first.json()["challenge_required"] is True
        assert codes

        approved = client.post(
            "/auth/login/verify",
            json={"challenge_token": first.json()["challenge_token"], "otp": codes[-1]},
            headers={"user-agent": chrome_ua},
        )
        assert approved.status_code == 200, approved.text
        assert "friink_device_id=" in approved.headers["set-cookie"]

        recognized = client.post("/auth/login", json={"identifier": email, "password": password}, headers={"user-agent": chrome_ua})
        assert recognized.status_code == 200, recognized.text
        assert recognized.json().get("challenge_required") is not True

        changed = client.post("/auth/login", json={"identifier": email, "password": password}, headers={"user-agent": firefox_ua})
        assert changed.status_code == 200, changed.text
        assert changed.json()["challenge_required"] is True
        changed_approved = client.post(
            "/auth/login/verify",
            json={"challenge_token": changed.json()["challenge_token"], "otp": codes[-1]},
            headers={"user-agent": firefox_ua},
        )
        assert changed_approved.status_code == 200, changed_approved.text

        same_changed_device = client.post("/auth/login", json={"identifier": email, "password": password}, headers={"user-agent": firefox_ua})
        assert same_changed_device.status_code == 200, same_changed_device.text
        assert same_changed_device.json().get("challenge_required") is not True

        new_device = TestClient(app).post("/auth/login", json={"identifier": email, "password": password}, headers={"user-agent": safari_ua})
        assert new_device.status_code == 200, new_device.text
        assert new_device.json()["challenge_required"] is True
    finally:
        app.dependency_overrides.pop(get_settings, None)
        _delete_user(user_id)


def test_account_lock_blocks_login_and_refresh_but_not_existing_access_token() -> None:
    password = "Strong1!pass"
    email = f"locked-{uuid.uuid4().hex}@example.com"
    user_id = _seed_user(email, f"locked_{uuid.uuid4().hex[:20]}", password)
    app.dependency_overrides[get_settings] = lambda: _settings()
    try:
        client = TestClient(app)
        login = client.post("/auth/login", json={"identifier": email, "password": password})
        assert login.status_code == 200, login.text
        access_token = login.json()["access_token"]
        with get_session_factory()() as session:
            session.get(User, user_id).account_locked = True
            session.commit()

        locked_login = client.post("/auth/login", json={"identifier": email, "password": password})
        assert locked_login.status_code == 423
        assert locked_login.json()["detail"] == "Your account is locked. Contact support."
        still_valid = client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert still_valid.status_code == 200, still_valid.text
        refresh = client.post("/auth/refresh")
        assert refresh.status_code == 401
        assert refresh.json()["detail"]["message"] == "Your account is locked. Contact support."
    finally:
        app.dependency_overrides.pop(get_settings, None)
        _delete_user(user_id)


def test_progressive_cooldown_has_distinct_tier_message() -> None:
    password = "Strong1!pass"
    email = f"cooldown-{uuid.uuid4().hex}@example.com"
    user_id = _seed_user(email, f"cooldown_{uuid.uuid4().hex[:19]}", password, failed_login_attempts=2)
    app.dependency_overrides[get_settings] = lambda: _settings()
    try:
        client = TestClient(app)
        failed = client.post("/auth/login", json={"identifier": email, "password": "Wrong1!pass"})
        assert failed.status_code == 401
        cooldown = client.post("/auth/login", json={"identifier": email, "password": password})
        assert cooldown.status_code == 429
        detail = cooldown.json()["detail"]
        assert detail["code"] == "LOGIN_COOLDOWN"
        assert "Too many login attempts" in detail["message"]
        assert "30 minutes" in detail["message"]
        assert "Your account is locked" not in detail["message"]
    finally:
        app.dependency_overrides.pop(get_settings, None)
        _delete_user(user_id)


def test_email_change_requires_new_email_otp_and_preserves_history(monkeypatch) -> None:
    codes: list[str] = []

    async def capture_code(self, email: str, otp_code: str) -> None:
        codes.append(otp_code)

    monkeypatch.setattr("app.services.email.EmailService.send_email_change_otp", capture_code)
    app.dependency_overrides[get_settings] = lambda: _settings()
    password = "Strong1!pass"
    email = f"email-change-{uuid.uuid4().hex}@example.com"
    new_email = f"new-{uuid.uuid4().hex}@example.com"
    user_id = _seed_user(email, f"emailchange_{uuid.uuid4().hex[:17]}", password)
    try:
        client = TestClient(app)
        login = client.post("/auth/login", json={"identifier": email, "password": password})
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        start = client.post("/auth/me/email/change/start", json={"email": new_email, "current_password": password}, headers=headers)
        assert start.status_code == 202, start.text
        verify = client.post(
            "/auth/me/email/change/verify",
            json={"challenge_token": start.json()["challenge_token"], "otp": codes[-1]},
            headers=headers,
        )
        assert verify.status_code == 200, verify.text
        assert verify.json()["email"] == new_email
    finally:
        app.dependency_overrides.pop(get_settings, None)
        _delete_user(user_id)


def test_expired_signup_reservations_are_cleanup_ready() -> None:
    reservation_id = uuid.uuid4()
    with get_session_factory()() as session:
        session.add(
            SignupReservation(
                id=reservation_id,
                token_hash=uuid.uuid4().hex.encode("ascii"),
                email=f"expired-{uuid.uuid4().hex}@example.com",
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        session.flush()
        session.add(
            OtpCode(
                signup_reservation_id=reservation_id,
                otp_hash=b"y" * 32,
                purpose="signup",
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        session.commit()
        assert purge_expired_signup_reservations(session) >= 1
        session.commit()
        assert session.get(SignupReservation, reservation_id) is None
        assert session.execute(select(OtpCode).where(OtpCode.signup_reservation_id == reservation_id)).scalar_one_or_none() is None
