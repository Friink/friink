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
    response = client.post("/auth/signup", json={"email": email, "username": username, "display_name": username, "password": "Strong-pass9!", "date_of_birth": "1990-01-01"})
    assert response.status_code == 201, response.text
    with get_session_factory()() as session:
        user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()
    return user_id, email, username


def test_block_removes_relationship_hides_profile_and_unblock_does_not_restore() -> None:
    suffix = uuid.uuid4().hex[:18]
    client = TestClient(app)
    user_ids: list[uuid.UUID] = []
    try:
        first_id, first_email, first_username = _signup(client, f"a{suffix}")
        second_id, second_email, second_username = _signup(client, f"b{suffix}")
        user_ids.extend([first_id, second_id])
        first_access = client.post("/auth/login", json={"email": first_email, "password": "Strong-pass9!"}).json()["access_token"]
        second_access = client.post("/auth/login", json={"email": second_email, "password": "Strong-pass9!"}).json()["access_token"]
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


def test_blocked_pending_request_freezes_count_and_unblock_does_not_extend_cap() -> None:
    suffix = uuid.uuid4().hex[:18]
    client = TestClient(app)
    user_ids: list[uuid.UUID] = []
    try:
        requester_id, requester_email, requester_username = _signup(client, f"c{suffix}")
        recipient_id, recipient_email, recipient_username = _signup(client, f"d{suffix}")
        user_ids.extend([requester_id, recipient_id])
        with get_session_factory()() as session:
            requester = session.get(User, requester_id)
            assert requester
            requester.subscription_tier = "pro"
            session.commit()
        requester_access = client.post("/auth/login", json={"email": requester_email, "password": "Strong-pass9!"}).json()["access_token"]
        recipient_access = client.post("/auth/login", json={"email": recipient_email, "password": "Strong-pass9!"}).json()["access_token"]
        requester_headers = {"Authorization": f"Bearer {requester_access}"}
        recipient_headers = {"Authorization": f"Bearer {recipient_access}"}
        first = client.post(f"/chat/conversations/with/{recipient_username}/messages", headers=requester_headers, json={"content": "one", "client_message_id": str(uuid.uuid4())})
        assert first.status_code == 201, first.text
        conversation_id = first.json()["conversation_id"]
        assert client.post(f"/users/{recipient_username}/block", headers=requester_headers).status_code == 200
        frozen = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": "blocked", "client_message_id": str(uuid.uuid4())})
        assert frozen.status_code == 403
        assert client.delete(f"/users/{recipient_username}/block", headers=requester_headers).status_code == 200
        resumed = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": "two", "client_message_id": str(uuid.uuid4())})
        assert resumed.status_code == 201, resumed.text
        for index in range(3, 9):
            response = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": str(index), "client_message_id": str(uuid.uuid4())})
            assert response.status_code == 201, response.text
        capped = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": "nine", "client_message_id": str(uuid.uuid4())})
        assert capped.status_code == 403
        recipient_view = client.get(f"/chat/conversations/{conversation_id}/messages", headers=recipient_headers)
        assert recipient_view.status_code == 200
        assert len(recipient_view.json()["items"]) == 8
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_(user_ids)))
            session.commit()
