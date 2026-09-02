import uuid
from fastapi.testclient import TestClient
from sqlalchemy import delete

from api.index import app
from app.db import get_session_factory
from app.models.chat import UserBlock
from app.models.user import User


def _signup(client: TestClient, suffix: str) -> tuple[uuid.UUID, str, str]:
    email = f"chat-{suffix}@example.com"
    username = f"chat_{suffix}"
    response = client.post(
        "/auth/signup",
        json={"email": email, "username": username, "display_name": username, "password": "Strong-password-9!", "date_of_birth": "1990-01-01"},
    )
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"]), email, username


def _access(client: TestClient, email: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": "Strong-password-9!"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_paid_chat_request_acceptance_limit_and_settings() -> None:
    suffix = uuid.uuid4().hex[:18]
    client = TestClient(app)
    user_ids: list[uuid.UUID] = []
    try:
        requester_id, requester_email, requester_username = _signup(client, f"a{suffix}")
        recipient_id, recipient_email, recipient_username = _signup(client, f"b{suffix}")
        user_ids.extend([requester_id, recipient_id])
        with get_session_factory()() as session:
            requester = session.get(User, requester_id)
            assert requester
            requester.subscription_tier = "pro"
            session.commit()

        requester_access = _access(client, requester_email)
        recipient_access = _access(client, recipient_email)
        requester_headers = {"Authorization": f"Bearer {requester_access}"}
        recipient_headers = {"Authorization": f"Bearer {recipient_access}"}

        new_context = client.post(f"/chat/conversations/with/{recipient_username}", headers=requester_headers)
        assert new_context.status_code == 200
        assert new_context.json()["conversation"] is None
        assert new_context.json()["can_send"] is True

        first = client.post(f"/chat/conversations/with/{recipient_username}/messages", headers=requester_headers, json={"content": "x" * 2048, "client_message_id": str(uuid.uuid4())})
        assert first.status_code == 201, first.text
        conversation_id = first.json()["conversation_id"]

        rejected_length = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": "x" * 2049, "client_message_id": str(uuid.uuid4())})
        assert rejected_length.status_code == 422

        recipient_context = client.post(f"/chat/conversations/with/{requester_username}", headers=recipient_headers)
        assert recipient_context.status_code == 200
        assert recipient_context.json()["conversation"]["status"] == "pending"
        assert recipient_context.json()["composer_placeholder"] == "Reply to accept."

        recipient_messages = client.get(f"/chat/conversations/{conversation_id}/messages", headers=recipient_headers)
        assert recipient_messages.status_code == 200, recipient_messages.text
        assert recipient_messages.json()["unread_count"] == 1
        requester_messages = client.get(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers)
        assert requester_messages.status_code == 200, requester_messages.text
        assert requester_messages.json()["items"][0]["receipt_status"] == "delivered"
        marked_read = client.post(f"/chat/conversations/{conversation_id}/read?message_id={first.json()['id']}", headers=recipient_headers)
        assert marked_read.status_code == 200, marked_read.text
        assert marked_read.json()["unread_count"] == 0
        requester_receipts = client.get(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers)
        assert requester_receipts.json()["items"][0]["receipt_status"] == "read"
        default_receipts = client.get("/chat/preferences/read-receipts", headers=recipient_headers)
        assert default_receipts.status_code == 200, default_receipts.text
        assert default_receipts.json()["read_receipts_enabled"] is True
        disabled_receipts = client.patch("/chat/preferences/read-receipts?enabled=false", headers=recipient_headers)
        assert disabled_receipts.status_code == 200, disabled_receipts.text
        assert disabled_receipts.json()["read_receipts_enabled"] is False
        hidden_read = client.get(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers)
        assert hidden_read.json()["items"][0]["receipt_status"] == "delivered"
        enabled_receipts = client.patch("/chat/preferences/read-receipts?enabled=true", headers=recipient_headers)
        assert enabled_receipts.status_code == 200, enabled_receipts.text

        for index in range(2, 9):
            response = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": f"Message {index}", "client_message_id": str(uuid.uuid4())})
            assert response.status_code == 201, response.text
        limited = client.post(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers, json={"content": "Too many", "client_message_id": str(uuid.uuid4())})
        assert limited.status_code == 403

        accepted = client.post(f"/chat/conversations/{conversation_id}/accept", headers=recipient_headers)
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["status"] == "accepted"

        unmuted = client.patch(f"/chat/conversations/{conversation_id}/settings?muted=false", headers=recipient_headers)
        assert unmuted.status_code == 200, unmuted.text
        assert unmuted.json()["muted"] is False
        archived = client.patch(f"/chat/conversations/{conversation_id}/settings?archived=true", headers=recipient_headers)
        assert archived.status_code == 200, archived.text
        assert archived.json()["archived"] is True
        assert archived.json()["muted"] is True
        unarchived = client.patch(f"/chat/conversations/{conversation_id}/settings?archived=false", headers=recipient_headers)
        assert unarchived.status_code == 200, unarchived.text
        assert unarchived.json()["archived"] is False
        assert unarchived.json()["muted"] is False

        with get_session_factory()() as session:
            session.add(UserBlock(blocker_id=recipient_id, blocked_id=requester_id))
            session.commit()
        blocked_receipts = client.get(f"/chat/conversations/{conversation_id}/messages", headers=requester_headers)
        assert blocked_receipts.status_code == 200, blocked_receipts.text
        assert blocked_receipts.json()["items"][0]["receipt_status"] == "sent"
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_(user_ids)))
            session.commit()
