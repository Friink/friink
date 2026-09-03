from app.config import Settings, get_settings


def profile_picture_url_for(user, settings: Settings | None = None) -> str | None:
    """Resolve a profile-picture object key using the active environment URL."""
    key = getattr(user, "profile_picture_key", None)
    if key:
        active_settings = settings or get_settings()
        public_url = active_settings.r2_public_url.strip()
        return f"{public_url.rstrip('/')}/{key}" if public_url else None
    return getattr(user, "profile_picture_url", None)
