import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.db import get_session_factory
from app.models.push_subscription import PushSubscription
from app.models.user import User


def _signup_and_login(client: TestClient, prefix: str) -> tuple[dict[str, str], uuid.UUID]:
    suffix = uuid.uuid4().hex
    email = f"{prefix}-{suffix}@example.com"
    username = f"{prefix}_{suffix[:12]}"
    password = "Strong-pass9!"
    signup = client.post(
        "/auth/signup",
        json={"email": email, "username": username, "display_name": prefix, "password": password, "date_of_birth": "1990-01-01"},
    )
    assert signup.status_code == 201, signup.text
    login = client.post("/auth/login", json={"identifier": email, "password": password})
    assert login.status_code == 200, login.text
    with get_session_factory()() as session:
        user_id = session.execute(select(User.id).where(User.email == email)).scalar_one()
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, user_id


def test_push_subscription_can_be_created_replaced_listed_and_revoked() -> None:
    client = TestClient(app)
    headers, user_id = _signup_and_login(client, "push-api")
    endpoint = f"https://push.example.test/{uuid.uuid4()}"
    try:
        created = client.post(
            "/notifications/push-subscriptions",
            headers=headers,
            json={"endpoint": endpoint, "keys": {"p256dh": "public-key", "auth": "auth-key"}, "device_label": "Laptop"},
        )
        assert created.status_code == 200, created.text
        created_json = created.json()
        assert created_json["endpoint"] == endpoint
        assert created_json["active"] is True
        assert "p256dh_key" not in created_json
        subscription_id = created_json["id"]

        replaced = client.post(
            "/notifications/push-subscriptions",
            headers=headers,
            json={"endpoint": endpoint, "keys": {"p256dh": "rotated-public-key", "auth": "rotated-auth-key"}, "device_label": "Updated laptop"},
        )
        assert replaced.status_code == 200, replaced.text
        assert replaced.json()["id"] == subscription_id
        assert replaced.json()["device_label"] == "Updated laptop"
        listed = client.get("/notifications/push-subscriptions", headers=headers)
        assert listed.status_code == 200, listed.text
        assert [item["id"] for item in listed.json()] == [subscription_id]

        revoked = client.delete(f"/notifications/push-subscriptions/{subscription_id}", headers=headers)
        assert revoked.status_code == 204, revoked.text
        assert client.get("/notifications/push-subscriptions", headers=headers).json() == []
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id == user_id))
            session.commit()


def test_push_subscription_isolated_by_owner_and_mutations_require_allowed_origin() -> None:
    client = TestClient(app)
    owner_headers, owner_id = _signup_and_login(client, "push-owner")
    other_headers, other_id = _signup_and_login(client, "push-other")
    subscription_id = None
    endpoint = f"https://push.example.test/{uuid.uuid4()}"
    try:
        created = client.post(
            "/notifications/push-subscriptions",
            headers={**owner_headers, "Origin": "https://evil.example"},
            json={"endpoint": endpoint, "keys": {"p256dh": "public-key", "auth": "auth-key"}},
        )
        assert created.status_code == 403, created.text

        created = client.post(
            "/notifications/push-subscriptions",
            headers=owner_headers,
            json={"endpoint": endpoint, "keys": {"p256dh": "public-key", "auth": "auth-key"}},
        )
        assert created.status_code == 200, created.text
        subscription_id = created.json()["id"]

        forbidden_delete = client.delete(f"/notifications/push-subscriptions/{subscription_id}", headers=other_headers)
        assert forbidden_delete.status_code == 404, forbidden_delete.text
        assert client.get("/notifications/push-subscriptions", headers=other_headers).json() == []
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_([owner_id, other_id])))
            session.commit()


def test_same_browser_subscription_can_be_enabled_for_multiple_accounts() -> None:
    client = TestClient(app)
    first_headers, first_id = _signup_and_login(client, "push-first")
    second_headers, second_id = _signup_and_login(client, "push-second")
    endpoint = f"https://push.example.test/{uuid.uuid4()}"
    try:
        payload = {"endpoint": endpoint, "keys": {"p256dh": "public-key", "auth": "auth-key"}}
        first = client.post("/notifications/push-subscriptions", headers=first_headers, json=payload)
        second = client.post("/notifications/push-subscriptions", headers=second_headers, json=payload)
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert first.json()["id"] != second.json()["id"]
        assert client.get("/notifications/push-subscriptions", headers=first_headers).json()[0]["endpoint"] == endpoint
        assert client.get("/notifications/push-subscriptions", headers=second_headers).json()[0]["endpoint"] == endpoint
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id.in_([first_id, second_id])))
            session.commit()


def test_push_subscription_rejects_invalid_payload() -> None:
    client = TestClient(app)
    headers, user_id = _signup_and_login(client, "push-validation")
    try:
        response = client.post(
            "/notifications/push-subscriptions",
            headers=headers,
            json={"endpoint": "not-a-url", "keys": {"p256dh": "", "auth": ""}},
        )
        assert response.status_code == 422, response.text
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id == user_id))
            session.commit()
