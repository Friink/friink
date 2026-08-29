import uuid
from datetime import date

import pytest
from pydantic import ValidationError

from app.models.post import Post
from app.models.user import User
from app.schemas.posts import CreatePostRequest
from app.services.posts import serialize_post, serialize_quoted_post


def test_post_content_rejects_513_characters() -> None:
    with pytest.raises(ValidationError):
        CreatePostRequest(content="x" * 513)


def test_post_content_accepts_512_characters() -> None:
    assert CreatePostRequest(content="x" * 512).content == "x" * 512


def test_media_payload_validates_max_16_files() -> None:
    payload = [{"url": f"https://example.com/{index}.jpg"} for index in range(17)]
    with pytest.raises(ValidationError):
        CreatePostRequest(content="text", media=payload)


def test_deleted_quoted_post_serializes_as_unavailable() -> None:
    quoted_post_id = uuid.uuid4()
    quoted = serialize_quoted_post(None, quoted_post_id)

    assert quoted is not None
    assert quoted.id == quoted_post_id
    assert quoted.unavailable is True
    assert quoted.content == "Original post unavailable."


def test_quote_of_quote_is_allowed_and_serializes_direct_quote_only() -> None:
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    original = Post(id=uuid.uuid4(), user_id=author.id, content="Original")
    quote = Post(id=uuid.uuid4(), user_id=author.id, content="Quote", quoted_post_id=original.id)
    quote.user = author

    serialized = serialize_quoted_post(quote, quote.id)

    assert serialized is not None
    assert serialized.id == quote.id
    assert serialized.content == "Quote"


def test_post_serialization_includes_display_name() -> None:
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        display_name="Author Name",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    post = Post(id=uuid.uuid4(), user_id=author.id, content="Hello")
    post.user = author

    serialized = serialize_post(post)

    assert serialized.author_username == "author"
    assert serialized.author_display_name == "Author Name"


def test_post_serialization_includes_reply_and_quote_counts() -> None:
    author = User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="author",
        display_name="Author Name",
        password_hash="hash",
        date_of_birth=date(2000, 1, 1),
    )
    post = Post(id=uuid.uuid4(), user_id=author.id, content="Hello")
    post.user = author
    post.reply_count = 3
    post.quote_count = 2

    serialized = serialize_post(post)

    assert serialized.reply_count == 3
    assert serialized.quote_count == 2
