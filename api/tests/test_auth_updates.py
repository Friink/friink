from datetime import date
import uuid

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.schemas.auth import UpdateCurrentUserRequest
from app.services import auth as service


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0
        self.refreshed: User | None = None

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, user: User) -> None:
        self.refreshed = user


def make_user(username: str, email: str) -> User:
    return User(
        id=uuid.uuid4(),
        email=email,
        username=username,
        display_name=username,
        about="",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )


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
