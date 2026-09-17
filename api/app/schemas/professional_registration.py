from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class RegistrationApplicationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    institute: str = Field(min_length=1, max_length=255)
    credential_id: str = Field(min_length=1, max_length=255)


class RegistrationDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(pattern="^(approve|reject|revoke)$")
    message: str | None = Field(default=None, max_length=2000)


class RegistrationPreferencesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    show_registered_badge: bool | None = None
    show_in_directory: bool | None = None


class RegistrationResponse(BaseModel):
    user_id: str | None = None
    username: str | None = None
    display_name: str | None = None
    email: str | None = None
    profile_picture_url: str | None = None
    id: str | None
    status: str | None
    institute: str | None
    credential_id: str | None
    decision_message: str | None
    show_registered_badge: bool
    show_in_directory: bool
    professional: bool
    directory_eligible: bool
    created_at: datetime | None
    decided_at: datetime | None


class DirectoryProfileResponse(BaseModel):
    public_id: str
    username: str
    display_name: str | None
    about: str | None
    profile_picture_url: str | None
    professional: bool
    friink_registered: bool
    institute: str | None
    credential_id: str | None
