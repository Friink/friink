import re


def generate_post_slug(content: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9\s]", "", content).lower()
    words = re.sub(r"\s+", " ", cleaned).strip().split(" ") if cleaned.strip() else []
    slug = "-".join(words[:8])
    if len(slug) > 64:
        slug = slug[:64].rsplit("-", 1)[0] if "-" in slug[:64] else ""
    return slug.strip("-")
