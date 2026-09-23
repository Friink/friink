from pydantic import BaseModel


class ProfileSaveStatusResponse(BaseModel):
    username: str
    saved: bool


class SavedProfileResponse(BaseModel):
    id: str
    username: str | None
    display_name: str | None
    profile_picture_url: str | None
    show_professional_badge: bool = False
    available: bool = True


class SavedProfilePageResponse(BaseModel):
    items: list[SavedProfileResponse]
    next_cursor: str | None = None
    has_more: bool
