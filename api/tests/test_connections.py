import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.models.connection import FollowRequest, FollowRequestStatus
from app.models.user import User
from app.schemas.connections import SendFollowRequestPayload
from app.services import connections as service


class FakeSession:
    def __init__(self) -> None:
        self.added: FollowRequest | None = None
        self.commits = 0

    def add(self, request: FollowRequest) -> None:
        request.id = request.id or uuid.uuid4()
        self.added = request

    async def commit(self) -> None:
        self.commits += 1


def make_user(username: str) -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{username}@example.com",
        username=username,
        is_private=False,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )


def make_request(requester: User, recipient: User, status: FollowRequestStatus = FollowRequestStatus.pending) -> FollowRequest:
    request = FollowRequest(
        id=uuid.uuid4(),
        requester_id=requester.id,
        recipient_id=recipient.id,
        status=status,
    )
    request.requester = requester
    request.recipient = recipient
    return request


@pytest.mark.asyncio
async def test_self_follow_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    user = make_user("alex")

    async def fake_recipient(session, payload):
        return user

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)

    with pytest.raises(HTTPException) as error:
        await service.send_follow_request(FakeSession(), user, SendFollowRequestPayload(recipient_username="alex"))

    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_pending_request_returns_existing(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    existing = make_request(requester, recipient)

    async def fake_recipient(session, payload):
        return recipient

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return existing if request_status == FollowRequestStatus.pending else None

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)

    result = await service.send_follow_request(FakeSession(), requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert result is existing


@pytest.mark.asyncio
async def test_follow_public_account_creates_immediate_relationship(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    recipient.is_private = False
    fake_session = FakeSession()

    async def fake_recipient(session, payload):
        return recipient

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_get_follow_request(session, request_id):
        return fake_session.added

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)
    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)

    created = await service.send_follow_request(fake_session, requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert created.status == FollowRequestStatus.accepted
    assert created.responded_at is not None


@pytest.mark.asyncio
async def test_follow_private_account_creates_pending_request(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    recipient.is_private = True
    fake_session = FakeSession()

    async def fake_recipient(session, payload):
        return recipient

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return None

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    async def fake_get_follow_request(session, request_id):
        return fake_session.added

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)
    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)

    created = await service.send_follow_request(fake_session, requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert created.status == FollowRequestStatus.pending
    assert created.responded_at is None


@pytest.mark.asyncio
async def test_accept_by_non_recipient_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    actor = make_user("actor")
    request = make_request(requester, recipient)

    async def fake_get_follow_request(session, request_id):
        return request

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)

    with pytest.raises(HTTPException) as error:
        await service.accept_follow_request(FakeSession(), actor, request.id)

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_reject_by_non_recipient_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    actor = make_user("actor")
    request = make_request(requester, recipient)

    async def fake_get_follow_request(session, request_id):
        return request

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)

    with pytest.raises(HTTPException) as error:
        await service.reject_follow_request(FakeSession(), actor, request.id)

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_cancel_by_non_requester_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    actor = make_user("actor")
    request = make_request(requester, recipient)

    async def fake_get_follow_request(session, request_id):
        return request

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)

    with pytest.raises(HTTPException) as error:
        await service.cancel_follow_request(FakeSession(), actor, request.id)

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_cancel_then_resend_creates_fresh_pending_request(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    recipient.is_private = True
    request = make_request(requester, recipient)
    fake_session = FakeSession()

    async def fake_get_follow_request(session, request_id):
        return request if request_id == request.id else fake_session.added

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)
    await service.cancel_follow_request(fake_session, requester, request.id)

    async def fake_recipient(session, payload):
        return recipient

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return None

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)

    resent = await service.send_follow_request(fake_session, requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert request.status == FollowRequestStatus.canceled
    assert resent is fake_session.added
    assert resent.status == FollowRequestStatus.pending
    assert resent.id != request.id


@pytest.mark.asyncio
async def test_decline_then_resend_is_blocked_for_24_hours(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    recipient.is_private = True
    request = make_request(requester, recipient)
    fake_session = FakeSession()
    denied_at = datetime(2026, 8, 29, 10, 0, tzinfo=UTC)

    async def fake_get_follow_request(session, request_id):
        return request if request_id == request.id else fake_session.added

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)
    monkeypatch.setattr(service, "_now", lambda: denied_at)
    await service.reject_follow_request(fake_session, recipient, request.id)

    async def fake_recipient(session, payload):
        return recipient

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return request

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)

    with pytest.raises(HTTPException) as error:
        await service.send_follow_request(fake_session, requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert request.status == FollowRequestStatus.rejected
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_decline_after_24_hours_allows_new_request(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    recipient.is_private = True
    request = make_request(requester, recipient, FollowRequestStatus.rejected)
    request.responded_at = datetime(2026, 8, 28, 8, 0, tzinfo=UTC)
    fake_session = FakeSession()

    async def fake_recipient(session, payload):
        return recipient

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return request

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    async def fake_get_follow_request(session, request_id):
        return fake_session.added

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)
    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)
    monkeypatch.setattr(service, "_now", lambda: request.responded_at + timedelta(hours=25))

    resent = await service.send_follow_request(fake_session, requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert resent.status == FollowRequestStatus.pending


@pytest.mark.asyncio
async def test_unfollow_removes_active_edge_without_stale_accepted_row(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    request = make_request(requester, recipient, FollowRequestStatus.accepted)

    async def fake_get_follow_request(session, request_id):
        return request

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)

    removed = await service.remove_connection(FakeSession(), requester, request.id)

    assert removed.status == FollowRequestStatus.canceled


@pytest.mark.asyncio
async def test_refollow_after_unfollow_requires_fresh_request(monkeypatch: pytest.MonkeyPatch) -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    recipient.is_private = True
    old_request = make_request(requester, recipient, FollowRequestStatus.accepted)
    fake_session = FakeSession()

    async def fake_get_follow_request(session, request_id):
        return old_request if request_id == old_request.id else fake_session.added

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)
    await service.remove_connection(fake_session, requester, old_request.id)

    async def fake_recipient(session, payload):
        return recipient

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return None

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return None

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)

    fresh = await service.send_follow_request(fake_session, requester, SendFollowRequestPayload(recipient_username="recipient"))

    assert old_request.status == FollowRequestStatus.canceled
    assert fresh.status == FollowRequestStatus.pending
    assert fresh.id != old_request.id


@pytest.mark.asyncio
async def test_removed_follower_is_blocked_for_24_hours(monkeypatch: pytest.MonkeyPatch) -> None:
    owner = make_user("owner")
    follower = make_user("follower")
    owner.is_private = False
    accepted = make_request(follower, owner, FollowRequestStatus.accepted)
    fake_session = FakeSession()
    removed_at = datetime(2026, 8, 29, 11, 0, tzinfo=UTC)

    async def fake_get_follow_request(session, request_id):
        return accepted if request_id == accepted.id else fake_session.added

    async def fake_get_user_by_username(session, username):
        return follower if username == follower.username else None

    async def fake_pair(session, requester_id, recipient_id, request_status):
        if requester_id == follower.id and recipient_id == owner.id and request_status == FollowRequestStatus.accepted:
            return accepted
        return None

    async def fake_recipient(session, payload):
        return owner

    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)
    monkeypatch.setattr(service, "get_user_by_username", fake_get_user_by_username)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_now", lambda: removed_at)

    removed = await service.remove_follower(fake_session, owner, follower.username)

    async def fake_pair_after_removal(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return None

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return removed

    monkeypatch.setattr(service, "_get_pair_request", fake_pair_after_removal)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)

    with pytest.raises(HTTPException) as error:
        await service.send_follow_request(fake_session, follower, SendFollowRequestPayload(recipient_username=owner.username))

    assert removed.status == FollowRequestStatus.canceled
    assert removed.removed_at == removed_at
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_removed_follower_can_follow_again_after_24_hours(monkeypatch: pytest.MonkeyPatch) -> None:
    owner = make_user("owner")
    follower = make_user("follower")
    owner.is_private = False
    removed = make_request(follower, owner, FollowRequestStatus.canceled)
    removed.removed_at = datetime(2026, 8, 28, 8, 0, tzinfo=UTC)
    fake_session = FakeSession()

    async def fake_recipient(session, payload):
        return owner

    async def fake_pair(session, requester_id, recipient_id, request_status):
        return None

    async def fake_latest_rejected_request(session, requester_id, recipient_id):
        return None

    async def fake_latest_removed_follower_request(session, requester_id, recipient_id):
        return removed

    async def fake_get_follow_request(session, request_id):
        return fake_session.added

    monkeypatch.setattr(service, "_get_recipient", fake_recipient)
    monkeypatch.setattr(service, "_get_pair_request", fake_pair)
    monkeypatch.setattr(service, "_get_latest_rejected_request", fake_latest_rejected_request)
    monkeypatch.setattr(service, "_get_latest_removed_follower_request", fake_latest_removed_follower_request)
    monkeypatch.setattr(service, "get_follow_request", fake_get_follow_request)
    monkeypatch.setattr(service, "_now", lambda: removed.removed_at + timedelta(hours=25))

    new_follow = await service.send_follow_request(fake_session, follower, SendFollowRequestPayload(recipient_username=owner.username))

    assert new_follow.status == FollowRequestStatus.accepted


def test_directional_follow_does_not_create_reverse_edge() -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    request = make_request(requester, recipient, FollowRequestStatus.accepted)

    assert request.requester_id == requester.id
    assert request.recipient_id == recipient.id
    assert request.requester_id != recipient.id


def test_live_counts_are_derived_from_accepted_directional_edges() -> None:
    requester = make_user("requester")
    recipient = make_user("recipient")
    accepted = make_request(requester, recipient, FollowRequestStatus.accepted)
    canceled = make_request(requester, recipient, FollowRequestStatus.canceled)
    rejected = make_request(recipient, requester, FollowRequestStatus.rejected)
    edges = [accepted, canceled, rejected]

    follower_count = sum(1 for edge in edges if edge.recipient_id == recipient.id and edge.status == FollowRequestStatus.accepted)
    following_count = sum(1 for edge in edges if edge.requester_id == requester.id and edge.status == FollowRequestStatus.accepted)

    assert follower_count == 1
    assert following_count == 1
