import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.profile_save import ProfileSave
from app.models.user import User
from app.services.security import hash_password


def _signup(client: TestClient, prefix: str) -> tuple[uuid.UUID, str, str]:
    email = f"{prefix}@example.com"
    username = prefix.replace("-", "_")
    user_id = uuid.uuid4()
    with get_session_factory()() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                username=username,
                username_key=username.casefold(),
                display_name=username,
                password_hash=hash_password("Strong-pass9!"),
                date_of_birth=date(1990, 1, 1),
                is_verified=True,
            )
        )
        session.commit()
    return user_id, email, username


def _login(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": "Strong-pass9!"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_profile_save_flow_preserves_unavailable_rows_without_identity_leak() -> None:
    suffix = uuid.uuid4().hex[:8]
    client = TestClient(app)
    user_ids: list[uuid.UUID] = []
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        JWT_SECRET_KEY="profile-save-test-secret",
        ENVIRONMENT="development",
        OTP_ENABLED=False,
    )
    try:
        owner_id, owner_email, owner_username = _signup(client, f"profile-save-owner-{suffix}")
        actor_id, actor_email, _ = _signup(client, f"profile-save-actor-{suffix}")
        user_ids.extend([owner_id, actor_id])
        actor_headers = _login(client, actor_email)

        initial = client.get(f"/users/{owner_username}/save", headers=actor_headers)
        assert initial.status_code == 200, initial.text
        assert initial.json()["saved"] is False

        saved = client.post(f"/users/{owner_username}/save", headers=actor_headers)
        assert saved.status_code == 200, saved.text
        assert saved.json()["saved"] is True
        assert client.post(f"/users/{owner_username}/save", headers=actor_headers).json()["saved"] is True

        listing = client.get("/users/saved", headers=actor_headers)
        assert listing.status_code == 200, listing.text
        assert listing.json()["items"][0]["username"] == owner_username
        profile_public_id = listing.json()["items"][0]["id"]

        with get_session_factory()() as session:
            session.get(User, owner_id).lifecycle_status = "deactivated"
            session.commit()

        unavailable = client.get("/users/saved", headers=actor_headers)
        assert unavailable.status_code == 200, unavailable.text
        item = unavailable.json()["items"][0]
        assert item["available"] is False
        assert item["username"] is None
        assert item["display_name"] is None

        assert client.delete(f"/users/saved/{profile_public_id}", headers=actor_headers).status_code == 204
        assert client.get("/users/saved", headers=actor_headers).json()["items"] == []
        assert client.post(f"/users/{owner_username}/save", headers=actor_headers).status_code == 404
    finally:
        app.dependency_overrides.pop(get_settings, None)
        with get_session_factory()() as session:
            session.execute(delete(ProfileSave).where(ProfileSave.user_id.in_(user_ids)))
            session.execute(delete(User).where(User.id.in_(user_ids)))
            session.commit()
