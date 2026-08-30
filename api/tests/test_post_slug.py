from app.services.post_slug import generate_post_slug


def test_post_slug_uses_first_eight_words_and_64_character_boundary() -> None:
    assert generate_post_slug("One two three four five six seven eight nine") == "one-two-three-four-five-six-seven-eight"
    assert len(generate_post_slug("word " * 20)) <= 64


def test_post_slug_drops_symbols_and_handles_empty_or_long_words() -> None:
    assert generate_post_slug("🔥 !!!") == ""
    assert generate_post_slug("A" * 65) == ""
    assert generate_post_slug("Hello, world! 2026") == "hello-world-2026"
