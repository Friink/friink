import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.db import get_session_factory
from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.user import User


def _signup(client: TestClient, suffix: str) -> tuple[uuid.UUID, str, str]:
    email = f"block-{suffix}@example.com"
    username = f"block_{suffix}"
    response = client.post("/auth/signup", json={"email": email, "username": username, "display_name": username, "password": "Strong-password-9!", "date_of_birth": "1990-01-01"})
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"]), email, username


def test_block_removes_relationship_hides_profile_and_unblock_does_not_restore() -> None:
    suffix = uuid.uuid4().hex[:18]
    client = TestClient(app)
    user_ids: list[uuid.UUID] = []
    try:
        first_id, first_email, first_username = _signup(client, f"a{suffix}")
        second_id, second_email, second_username = _signup(client, f"b{suffix}")
        user_ids.extend([first_id, second_id])
        first_access = client.post("/auth/login", json={"email": first_email, "password": "Strong-password-9!"}).json()["access_token"]
        second_access = client.post("/auth/login", json={"email": second_email, "password": "Strong-password-9!"}).json()["access_token"]
        first_headers = {"Authorization": f"Bearer {first_access}"}
        second_headers = {"Authorization": f"Bearer {second_access}"}

        followed = client.post("/connections/requests", headers=first_headers, json={"recipient_username": second_username})
        assert followed.status_code == 201
        blocked = client.post(f"/users/{second_username}/block", headers=first_headers)
        assert blocked.status_code == 200
        assert client.get(f"/auth/users/{second_username}", headers=first_headers).status_code == 404
        assert client.get(f"/connections/status/{second_username}", headers=first_headers).json()["state"] == "none"
        listed = client.get("/users/blocked?query=block_", headers=first_headers)
        assert listed.status_code == 200
        assert [item["username"] for item in listed.json()["items"]] == [second_username]
        assert client.post(f"/connections/requests", headers=second_headers, json={"recipient_username": first_username}).status_code == 403
        assert client.delete(f"/users/{second_username}/block", headers=first_headers).status_code == 200
        assert client.get(f"/connections/status/{second_username}", headers=first_headers).json()["state"] == "none"
        with get_session_factory()() as session:
            assert session.execute(select(FollowRequest).where(FollowRequest.requester_id.in_(user_ids), FollowRequest.recipient_id.in_(user_ids), FollowRequest.status == FollowRequestStatus.accepted)).scalars().all() == []
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_(user_ids)))
            session.commit()
