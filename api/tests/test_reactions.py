import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from api.index import app
from app.db import get_session_factory
from app.models.notification import Notification
from app.models.post import PostLike, PostStar
from app.models.user import User


def _signup(client: TestClient, prefix: str) -> tuple[uuid.UUID, str, str]:
    email = f"{prefix}@example.com"
    username = prefix.replace("-", "_")
    response = client.post(
        "/auth/signup",
        json={
            "email": email,
            "username": username,
            "display_name": username,
            "password": "Strong-password-9!",
            "date_of_birth": "1990-01-01",
        },
    )
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"]), email, username


def _login(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": "Strong-password-9!"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_like_and_star_flow_notification_visibility_and_lists() -> None:
    suffix = uuid.uuid4().hex[:18]
    client = TestClient(app)
    user_ids: list[uuid.UUID] = []
    try:
        owner_id, owner_email, owner_username = _signup(client, f"react-owner-{suffix}")
        actor_id, actor_email, actor_username = _signup(client, f"react-actor-{suffix}")
        user_ids.extend([owner_id, actor_id])
        owner_headers = _login(client, owner_email)
        actor_headers = _login(client, actor_email)

        created = client.post("/posts", headers=owner_headers, json={"content": "A post to react to"})
        assert created.status_code == 201, created.text
        post = created.json()
        post_id = post["id"]
        assert post["like_count"] == 0
        assert post["star_count"] == 0
        assert post["liked"] is False
        assert post["starred"] is False
        anonymous_post = client.get(f"/posts/{post_id}")
        assert anonymous_post.status_code == 200, anonymous_post.text
        assert anonymous_post.json()["like_count"] == 0
        assert anonymous_post.json()["star_count"] == 0
        assert anonymous_post.json()["liked"] is None
        assert anonymous_post.json()["starred"] is None

        self_like = client.post(f"/posts/{post_id}/like", headers=owner_headers)
        assert self_like.status_code == 200, self_like.text
        assert self_like.json()["like_count"] == 1
        actor_like = client.post(f"/posts/{post_id}/like", headers=actor_headers)
        assert actor_like.status_code == 200, actor_like.text
        assert actor_like.json()["like_count"] == 2
        assert client.post(f"/posts/{post_id}/like", headers=actor_headers).json()["like_count"] == 2
        with ThreadPoolExecutor(max_workers=2) as executor:
            concurrent_results = list(executor.map(lambda _: client.post(f"/posts/{post_id}/like", headers=actor_headers), range(2)))
        assert all(response.status_code == 200 for response in concurrent_results)
        assert {response.json()["like_count"] for response in concurrent_results} == {2}

        actor_star = client.post(f"/posts/{post_id}/star", headers=actor_headers)
        assert actor_star.status_code == 200, actor_star.text
        assert actor_star.json()["star_count"] == 1
        assert client.post(f"/posts/{post_id}/star", headers=actor_headers).json()["star_count"] == 1

        notifications = client.get("/notifications", headers=owner_headers)
        assert notifications.status_code == 200, notifications.text
        like_notifications = [item for item in notifications.json()["items"] if item["type"] == "like"]
        assert len(like_notifications) == 1
        assert like_notifications[0]["payload"]["actor_username"] == actor_username
        assert like_notifications[0]["payload"]["post_author_username"] == owner_username

        owner_post = client.get(f"/posts/{post_id}", headers=owner_headers).json()
        assert owner_post["like_count"] == 2
        assert owner_post["star_count"] == 1
        assert owner_post["liked"] is True
        assert owner_post["starred"] is False

        actor_likes = client.get(f"/users/{actor_username}/likes", headers=actor_headers)
        assert actor_likes.status_code == 200, actor_likes.text
        assert [item["id"] for item in actor_likes.json()["items"]] == [post_id]
        actor_stars = client.get("/posts/starred", headers=actor_headers)
        assert actor_stars.status_code == 200, actor_stars.text
        assert [item["id"] for item in actor_stars.json()["items"]] == [post_id]

        like_actors = client.get(f"/posts/{post_id}/likes", headers=owner_headers)
        assert like_actors.status_code == 200, like_actors.text
        assert {item["username"] for item in like_actors.json()["items"]} == {owner_username, actor_username}

        assert client.delete(f"/posts/{post_id}/like", headers=actor_headers).json()["like_count"] == 1
        assert client.delete(f"/posts/{post_id}/star", headers=actor_headers).json()["star_count"] == 0
        assert client.delete(f"/posts/{post_id}/like", headers=actor_headers).json()["like_count"] == 1

        assert client.patch("/auth/me", headers=actor_headers, json={"likes_visible": False}).status_code == 200
        hidden_likes = client.get(f"/users/{actor_username}/likes", headers=owner_headers)
        assert hidden_likes.status_code == 404
        hidden_actor = client.get(f"/posts/{post_id}/likes", headers=owner_headers).json()
        assert actor_username not in {item["username"] for item in hidden_actor["items"]}
        still_public_count = client.get(f"/posts/{post_id}", headers=owner_headers).json()
        assert still_public_count["like_count"] == 1
    finally:
        with get_session_factory()() as session:
            session.execute(delete(Notification).where(Notification.recipient_user_id.in_(user_ids)))
            session.execute(delete(PostLike).where(PostLike.user_id.in_(user_ids)))
            session.execute(delete(PostStar).where(PostStar.user_id.in_(user_ids)))
            session.execute(delete(User).where(User.id.in_(user_ids)))
            session.commit()
