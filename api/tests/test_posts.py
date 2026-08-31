import uuid
from datetime import UTC, date, datetime

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.post import Post
from app.models.post import PostKind
from app.models.user import User
from app.schemas.posts import CreatePostRequest
from app.services.posts import can_view_post, clamp_feed_limit, create_post, decode_post_cursor, encode_post_cursor, extract_mentioned_usernames, serialize_post, serialize_quoted_post


def test_post_content_rejects_513_characters() -> None:
    with pytest.raises(ValidationError):
        CreatePostRequest(content="x" * 513)


def test_post_content_accepts_512_characters() -> None:
    assert CreatePostRequest(content="x" * 512).content == "x" * 512


def test_extract_mentioned_usernames_deduplicates_valid_mentions() -> None:
    assert extract_mentioned_usernames("Hi @areeba, @areeba and (@muflah). email@domain.com") == ["areeba", "muflah"]


def test_post_content_is_required_for_posts_and_replies() -> None:
    with pytest.raises(ValidationError):
        CreatePostRequest(content="")

    with pytest.raises(ValidationError):
        CreatePostRequest(content=" ", kind="reply", parent_post_id=uuid.uuid4())


def test_quote_content_can_be_empty() -> None:
    quoted_post_id = uuid.uuid4()

    payload = CreatePostRequest(content="", kind="quote", quoted_post_id=quoted_post_id)

    assert payload.content == ""
    assert payload.quoted_post_id == quoted_post_id


def test_media_payload_validates_max_8_files() -> None:
    payload = [{"storage_key": f"post-media/user/{index}.jpg"} for index in range(9)]
    with pytest.raises(ValidationError):
        CreatePostRequest(content="text", media=payload)


def test_deleted_quoted_post_serializes_as_unavailable() -> None:
    quoted_post_id = uuid.uuid4()
    quoted = serialize_quoted_post(None, quoted_post_id)

    assert quoted is not None
    assert quoted.id == quoted_post_id
    assert quoted.unavailable is True
    assert quoted.content == "Original post unavailable."


def test_private_quoted_post_serializes_as_unavailable_without_viewer_session() -> None:
    author = User(
        id=uuid.uuid4(),
        email="private@example.com",
        username="private",
        is_private=True,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    quoted_post = Post(id=uuid.uuid4(), user_id=author.id, kind=PostKind.POST, content="Hidden", media_count=0)
    quoted_post.user = author

    quoted = serialize_quoted_post(quoted_post, quoted_post.id)

    assert quoted is not None
    assert quoted.unavailable is True
    assert quoted.content == "Content not available"


def test_quote_of_quote_is_allowed_and_serializes_direct_quote_only() -> None:
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        display_name="Author Name",
        profile_picture_url="https://cdn.example.com/author.jpg",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    original = Post(id=uuid.uuid4(), user_id=author.id, kind=PostKind.POST, content="Original", media_count=0)
    quote = Post(id=uuid.uuid4(), user_id=author.id, kind=PostKind.QUOTE, content="Quote", quoted_post_id=original.id, media_count=0)
    quote.user = author

    serialized = serialize_quoted_post(quote, quote.id)

    assert serialized is not None
    assert serialized.id == quote.id
    assert serialized.author_display_name == "Author Name"
    assert serialized.profile_picture_url == "https://cdn.example.com/author.jpg"
    assert serialized.content == "Quote"


def test_post_serialization_includes_display_name() -> None:
    timestamp = datetime(2026, 8, 29, 8, 45, tzinfo=UTC)
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        display_name="Author Name",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    post = Post(id=uuid.uuid4(), user_id=author.id, kind=PostKind.POST, content="Hello", media_count=0, created_at=timestamp, updated_at=timestamp)
    post.user = author

    serialized = serialize_post(post)

    assert serialized.author_username == "author"
    assert serialized.author_display_name == "Author Name"


def test_post_serialization_includes_reply_and_quote_counts() -> None:
    timestamp = datetime(2026, 8, 29, 8, 45, tzinfo=UTC)
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        display_name="Author Name",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    post = Post(id=uuid.uuid4(), user_id=author.id, kind=PostKind.POST, content="Hello", media_count=0, created_at=timestamp, updated_at=timestamp)
    post.user = author
    post.reply_count = 3
    post.quote_count = 2

    serialized = serialize_post(post)

    assert serialized.reply_count == 3
    assert serialized.quote_count == 2


def test_feed_cursor_round_trips_created_at_and_id() -> None:
    created_at = datetime(2026, 8, 29, 8, 45, tzinfo=UTC)
    post = Post(id=uuid.uuid4(), user_id=uuid.uuid4(), kind=PostKind.POST, content="Hello", media_count=0, created_at=created_at)

    cursor = encode_post_cursor(post)
    decoded_created_at, decoded_post_id = decode_post_cursor(cursor)

    assert decoded_created_at == created_at
    assert decoded_post_id == post.id


def test_invalid_feed_cursor_is_rejected() -> None:
    with pytest.raises(HTTPException) as error:
        decode_post_cursor("not-a-valid-cursor")

    assert error.value.detail == "Invalid feed cursor."


def test_feed_limit_is_clamped_to_supported_range() -> None:
    assert clamp_feed_limit(0) == 1
    assert clamp_feed_limit(20) == 20
    assert clamp_feed_limit(1000) == 100


def test_private_post_requires_owner_or_accepted_follower() -> None:
    owner = User(
        id=uuid.uuid4(),
        email="owner@example.com",
        username="owner",
        is_private=True,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    viewer = User(
        id=uuid.uuid4(),
        email="viewer@example.com",
        username="viewer",
        is_private=False,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    post = Post(id=uuid.uuid4(), user_id=owner.id, kind=PostKind.POST, content="Hidden", media_count=0)
    post.user = owner

    class EmptySession:
        def execute(self, statement):
            class Result:
                def scalar_one_or_none(self):
                    return None

            return Result()

    assert can_view_post(EmptySession(), None, post) is False
    assert can_view_post(EmptySession(), owner, post) is True
    assert can_view_post(EmptySession(), viewer, post) is False


@pytest.mark.asyncio
async def test_reply_creation_rechecks_parent_visibility(monkeypatch: pytest.MonkeyPatch) -> None:
    owner = User(
        id=uuid.uuid4(),
        email="owner@example.com",
        username="owner",
        is_private=True,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    viewer = User(
        id=uuid.uuid4(),
        email="viewer@example.com",
        username="viewer",
        is_private=False,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    parent = Post(id=uuid.uuid4(), user_id=owner.id, kind=PostKind.POST, content="Hidden", media_count=0)
    parent.user = owner

    class Session:
        def get(self, model, object_id):
            return parent

        def execute(self, statement):
            class Result:
                def scalar_one_or_none(self):
                    return None

            return Result()

    with pytest.raises(HTTPException) as error:
        await create_post(Session(), viewer, CreatePostRequest(content="Nope", kind="reply", parent_post_id=parent.id))

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_quote_creation_blocks_private_posts_even_for_owner() -> None:
    owner = User(
        id=uuid.uuid4(),
        email="owner@example.com",
        username="owner",
        is_private=True,
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    quoted = Post(id=uuid.uuid4(), user_id=owner.id, kind=PostKind.POST, content="Hidden", media_count=0)
    quoted.user = owner

    class Session:
        def get(self, model, object_id):
            return quoted if model is Post else owner

    with pytest.raises(HTTPException) as error:
        await create_post(Session(), owner, CreatePostRequest(content="Nope", kind="quote", quoted_post_id=quoted.id))

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_mention_notification_failure_does_not_rollback_post(monkeypatch: pytest.MonkeyPatch) -> None:
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        display_name="Author",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    mentioned = User(
        id=uuid.uuid4(),
        email="mentioned@example.com",
        username="mentioned",
        display_name="Mentioned",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )

    class Session:
        def __init__(self) -> None:
            self.commits = 0
            self.rollbacks = 0

        def add(self, instance) -> None:
            self.post = instance

        def execute(self, statement):
            class Result:
                def scalars(self):
                    return self

                def all(self):
                    return [mentioned]

            return Result()

        def commit(self) -> None:
            self.commits += 1

        def refresh(self, instance) -> None:
            return None

        def rollback(self) -> None:
            self.rollbacks += 1

    session = Session()

    def fail_notification(*args, **kwargs):
        raise RuntimeError("notification store unavailable")

    monkeypatch.setattr("app.services.posts.create_notification", fail_notification)

    post = await create_post(session, author, CreatePostRequest(content="Hello @mentioned"))

    assert post is session.post
    assert session.commits == 1
    assert session.rollbacks == 1
