import re
import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.otp import OtpCode
from app.models.signup_reservation import SignupReservation
from app.models.user import User
from app.services.security import hash_password


def _payload(suffix: str) -> dict[str, str]:
    return {
        "email": f"phase2-signup-{suffix}@example.com",
        "username": f"Phase2Signup_{suffix[:18]}",
        "display_name": "Phase 2 Signup",
        "password": "Password1!",
        "date_of_birth": "1990-01-01",
    }


def test_signup_start_is_neutral_and_verification_creates_only_after_valid_otp(monkeypatch) -> None:
    sent_codes: list[str] = []

    async def capture_code(self, email: str, otp_code: str) -> None:
        sent_codes.append(otp_code)

    monkeypatch.setattr("app.services.email.EmailService.send_signup_otp", capture_code)
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        JWT_SECRET_KEY="phase2-test-secret",
        ENVIRONMENT="development",
        FRONTEND_URL="http://localhost:3000",
        SIGNUP_OTP_ENABLED=True,
    )

    suffix = uuid.uuid4().hex
    payload = _payload(suffix)
    existing_email = f"existing-phase2-{suffix}@example.com"
    existing_user_id = uuid.uuid4()
    new_user_id = None
    try:
        with get_session_factory()() as session:
            session.add(
                User(
                    id=existing_user_id,
                    email=existing_email,
                    username=f"existing_{suffix[:20]}",
                    username_key=f"existing_{suffix[:20]}".casefold(),
                    password_hash=hash_password("Password1!"),
                    date_of_birth=date(1990, 1, 1),
                    is_verified=True,
                )
            )
            session.commit()

        client = TestClient(app)
        existing = client.post("/auth/signup/start", json={**payload, "email": existing_email})
        fresh = client.post("/auth/signup/start", json=payload)
        assert existing.status_code == fresh.status_code == 202
        assert existing.json()["accepted"] is True
        assert fresh.json()["accepted"] is True
        assert existing.json()["verification_required"] is fresh.json()["verification_required"] is True
        assert existing.json()["message"] == fresh.json()["message"]
        assert re.fullmatch(r"[A-Za-z0-9_-]{32,128}", fresh.json()["reservation_token"])

        with get_session_factory()() as session:
            assert session.execute(select(User).where(User.email == payload["email"])).scalar_one_or_none() is None
            reservation = session.execute(
                select(SignupReservation).where(SignupReservation.email == payload["email"])
            ).scalar_one()
            otp = session.execute(select(OtpCode).where(OtpCode.signup_reservation_id == reservation.id)).scalar_one()
            assert otp.otp_hash and len(otp.otp_hash) == 32
            assert otp.user_id is None

        assert len(sent_codes) == 1
        assert re.fullmatch(r"[A-Z0-9]{6}", sent_codes[0])
        invalid = client.post(
            "/auth/signup/verify",
            json={"reservation_token": fresh.json()["reservation_token"], "otp": "AAAAAA"},
        )
        assert invalid.status_code == 400

        verified = client.post(
            "/auth/signup/verify",
            json={"reservation_token": fresh.json()["reservation_token"], "otp": sent_codes[0].lower()},
        )
        assert verified.status_code == 201, verified.text
        new_user_id = verified.json()["id"]
        assert verified.json()["email"] == payload["email"].lower()

        replay = client.post(
            "/auth/signup/verify",
            json={"reservation_token": fresh.json()["reservation_token"], "otp": sent_codes[0]},
        )
        assert replay.status_code == 400
    finally:
        app.dependency_overrides.pop(get_settings, None)
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_([existing_user_id, new_user_id] if new_user_id else [existing_user_id])))
            session.execute(delete(SignupReservation).where(SignupReservation.email == payload["email"]))
            session.commit()
