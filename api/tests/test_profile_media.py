from app.config import Settings
from app.models.user import User
from app.services.profile_media import profile_picture_url_for


def test_profile_picture_key_uses_active_environment_url() -> None:
    user = User(profile_picture_key="profile-pictures/user-id/new.jpg")
    settings = Settings(_env_file=None, JWT_SECRET_KEY="profile-media-test", R2_PUBLIC_URL="https://media.example.com")

    assert profile_picture_url_for(user, settings) == "https://media.example.com/profile-pictures/user-id/new.jpg"


def test_profile_picture_url_falls_back_for_legacy_rows() -> None:
    user = User(profile_picture_url="https://legacy.example.com/profile.jpg")
    settings = Settings(_env_file=None, JWT_SECRET_KEY="profile-media-test", R2_PUBLIC_URL="https://media.example.com")

    assert profile_picture_url_for(user, settings) == "https://legacy.example.com/profile.jpg"
