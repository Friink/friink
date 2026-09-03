import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.db import get_session_factory
from app.models.auth_session import AuthSession
from app.models.recognized_device import RecognizedDevice
from app.models.user import User
from app.services.security import hash_password


def test_login_reuses_server_device_record_and_rotates_for_new_cookie() -> None:
    user_id = uuid.uuid4()
    email = f"phase2-device-{uuid.uuid4().hex}@example.com"
    password = "Password1!"
    username = f"device_{uuid.uuid4().hex[:20]}"
    try:
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
                )
            )
            session.commit()

        first_client = TestClient(app)
        first = first_client.post(
            "/auth/login",
            json={"email": email, "password": password},
            headers={"user-agent": "Phase2Browser/1.0"},
        )
        assert first.status_code == 200, first.text
        assert "friink_device_id=" in first.headers["set-cookie"]
        assert "HttpOnly" in first.headers["set-cookie"]
        assert "device_id" not in first.json()

        second = first_client.post(
            "/auth/login",
            json={"email": email, "password": password},
            headers={"user-agent": "Phase2Browser/1.0"},
        )
        assert second.status_code == 200, second.text

        second_client = TestClient(app)
        new_device = second_client.post(
            "/auth/login",
            json={"email": email, "password": password},
            headers={"user-agent": "Phase2Mobile/2.0"},
        )
        assert new_device.status_code == 200, new_device.text

        with get_session_factory()() as session:
            devices = session.execute(
                select(RecognizedDevice).where(RecognizedDevice.user_id == user_id)
            ).scalars().all()
            sessions = session.execute(select(AuthSession).where(AuthSession.user_id == user_id)).scalars().all()
            assert len(devices) == 2
            assert len(sessions) == 3
            assert {item.device_id for item in sessions} == {item.id for item in devices}
            assert all(len(item.token_hash) == 32 for item in devices)
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id == user_id))
            session.commit()
