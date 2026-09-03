import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete

from api.index import app
from app.db import get_session_factory
from app.models.user import User


def test_reserved_username_and_display_casing_contract() -> None:
    client = TestClient(app)
    email = f"phase2-{uuid.uuid4().hex}@example.com"
    username = f"CamelCase_{uuid.uuid4().hex[:12]}"
    user_id = None
    try:
        reserved = client.post(
            "/auth/signup",
            json={
                "email": f"reserved-{uuid.uuid4().hex}@example.com",
                "username": "AdMiN",
                "display_name": "Reserved",
                "password": "Password1!",
                "date_of_birth": "1990-01-01",
            },
        )
        assert reserved.status_code == 409

        created = client.post(
            "/auth/signup",
            json={
                "email": email,
                "username": username,
                "display_name": "Phase 2",
                "password": "Password1!",
                "date_of_birth": "1990-01-01",
            },
        )
        assert created.status_code == 201, created.text
        user_id = created.json()["id"]
        assert created.json()["username"] == username

        availability = client.get(f"/auth/username-availability?username={username.lower()}")
        assert availability.status_code == 200
        assert availability.json()["available"] is False
    finally:
        if user_id:
            with get_session_factory()() as session:
                session.execute(delete(User).where(User.id == user_id))
                session.commit()
