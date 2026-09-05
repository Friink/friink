from datetime import UTC, date, datetime
import uuid

import pytest
from fastapi import HTTPException

from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.notification import Notification
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, UpdateCurrentUserRequest
from app.services import auth as service
from app.services.security import hash_password, verify_password


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0
        self.refreshed: User | None = None
        self.pending_requests: list[FollowRequest] = []
        self.notifications: list[Notification] = []

    def add(self, item) -> None:
        if isinstance(item, Notification):
            self.notifications.append(item)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, user: User) -> None:
        self.refreshed = user

    def execute(self, statement):
        class Result:
            def __init__(self, rows):
                self._rows = rows

            def scalars(self):
                return self

            def all(self):
                return self._rows

        return Result(self.pending_requests)


def make_user(username: str, email: str) -> User:
    return User(
        id=uuid.uuid4(),
        email=email,
        username=username,
        display_name=username,
        about="",
        is_private=False,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )


def test_login_request_accepts_email_or_username_identifier() -> None:
    assert LoginRequest(identifier="Alex", password="Password1!").identifier == "Alex"
    assert LoginRequest(email="alex@example.com", password="Password1!").identifier == "alex@example.com"


@pytest.mark.asyncio
async def test_login_identifier_uses_case_insensitive_username_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    user = make_user("Alex", "alex@example.com")
    looked_up: list[str] = []

    async def fake_get_user_by_username(session, username):
        looked_up.append(username)
        return user

    async def fail_email_lookup(session, email):
        raise AssertionError("email lookup should not be used for a username identifier")

    monkeypatch.setattr(service, "get_user_by_username", fake_get_user_by_username)
    monkeypatch.setattr(service, "get_user_by_email", fail_email_lookup)

    result = await service.get_user_by_login_identifier(FakeSession(), "  aLeX  ")

    assert result is user
    assert looked_up == ["aLeX"]


@pytest.mark.asyncio
async def test_authenticate_user_accepts_username(monkeypatch: pytest.MonkeyPatch) -> None:
    user = make_user("Alex", "alex@example.com")
    user.password_hash = hash_password("Password1!")

    async def fake_get_user_by_username(session, username):
        return user if username.casefold() == "alex" else None

    monkeypatch.setattr(service, "get_user_by_username", fake_get_user_by_username)

    result = await service.authenticate_user(FakeSession(), "ALEX", "Password1!")

    assert result is user


@pytest.mark.asyncio
async def test_update_current_user_rejects_duplicate_email(monkeypatch: pytest.MonkeyPatch) -> None:
    user = make_user("alex", "alex@example.com")
    other = make_user("sam", "sam@example.com")

    async def fake_get_user_by_email(session, email):
        return other

    monkeypatch.setattr(service, "get_user_by_email", fake_get_user_by_email)

    with pytest.raises(HTTPException) as error:
        await service.update_current_user(FakeSession(), user, UpdateCurrentUserRequest(email="sam@example.com"))

    assert error.value.status_code == 409
    assert user.email == "alex@example.com"


@pytest.mark.asyncio
async def test_update_current_user_rejects_duplicate_username_case_insensitively(monkeypatch: pytest.MonkeyPatch) -> None:
    user = make_user("alex", "alex@example.com")
    other = make_user("Areeba", "areeba@example.com")

    async def fake_get_user_by_username(session, username):
        return other if username.lower() == other.username.lower() else None

    monkeypatch.setattr(service, "get_user_by_username", fake_get_user_by_username)

    with pytest.raises(HTTPException) as error:
        await service.update_current_user(FakeSession(), user, UpdateCurrentUserRequest(username="areeba"))

    assert error.value.status_code == 409
    assert user.username == "alex"


@pytest.mark.asyncio
async def test_update_current_user_updates_profile_fields() -> None:
    user = make_user("alex", "alex@example.com")
    session = FakeSession()

    updated = await service.update_current_user(
        session,
        user,
        UpdateCurrentUserRequest(display_name="Alex Morgan", about="Builder of quiet social software."),
    )

    assert updated.display_name == "Alex Morgan"
    assert updated.about == "Builder of quiet social software."
    assert session.commits == 1
    assert session.refreshed is user


@pytest.mark.asyncio
async def test_change_password_requires_current_password() -> None:
    user = make_user("alex", "alex@example.com")
    user.password_hash = hash_password("CurrentPass1!")

    with pytest.raises(HTTPException) as error:
        await service.change_password(
            FakeSession(),
            user,
            ChangePasswordRequest(current_password="wrong", new_password="NewPass1!", confirm_password="NewPass1!"),
        )

    assert error.value.status_code == 400
    assert verify_password("CurrentPass1!", user.password_hash)


@pytest.mark.asyncio
async def test_change_password_replaces_hash_and_keeps_session_data() -> None:
    user = make_user("alex", "alex@example.com")
    user.password_hash = hash_password("CurrentPass1!")
    session = FakeSession()

    await service.change_password(
        session,
        user,
        ChangePasswordRequest(current_password="CurrentPass1!", new_password="NewPass1!", confirm_password="NewPass1!"),
    )

    assert verify_password("NewPass1!", user.password_hash)
    assert not verify_password("CurrentPass1!", user.password_hash)
    assert session.commits == 1


@pytest.mark.asyncio
async def test_switching_private_profile_to_public_auto_accepts_pending_requests() -> None:
    user = make_user("alex", "alex@example.com")
    user.is_private = True
    follower = make_user("sam", "sam@example.com")
    pending_request = FollowRequest(
        id=uuid.uuid4(),
        requester_id=follower.id,
        recipient_id=user.id,
        status=FollowRequestStatus.pending,
    )
    pending_request.requester = follower
    pending_request.recipient = user
    session = FakeSession()
    session.pending_requests = [pending_request]

    updated = await service.update_current_user(
        session,
        user,
        UpdateCurrentUserRequest(is_private=False),
    )

    assert updated.is_private is False
    assert pending_request.status == FollowRequestStatus.accepted
    assert pending_request.responded_at is not None
    assert session.commits == 1
