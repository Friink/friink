import re
import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


def validate_password_rules(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if any(character.isspace() for character in password):
        raise ValueError("Password must not contain spaces.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least 1 uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least 1 lowercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must include at least 1 number.")
    if not re.search(r"[^A-Za-z0-9\s]", password):
        raise ValueError("Password must include at least 1 special character.")
    return password


def validate_username_rules(username: str) -> str:
    if " " in username or not USERNAME_PATTERN.fullmatch(username):
        raise ValueError("Username may contain only letters, numbers, '-', '_', and '.' with no spaces.")
    return username


def validate_minimum_age(date_of_birth: date, minimum_age: int = 13, today: date | None = None) -> date:
    today = today or date.today()
    age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    if age < minimum_age:
        raise ValueError("User must be at least 13 years old.")
    return date_of_birth


class SignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    password: str
    date_of_birth: date
    location: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        return validate_password_rules(password)

    @field_validator("username")
    @classmethod
    def validate_username(cls, username: str) -> str:
        return validate_username_rules(username)

    @field_validator("date_of_birth")
    @classmethod
    def validate_age(cls, date_of_birth: date) -> date:
        return validate_minimum_age(date_of_birth)


class SignupStartResponse(BaseModel):
    accepted: bool = True
    verification_required: bool
    reservation_token: str
    message: str


class SignupVerifyRequest(BaseModel):
    reservation_token: str = Field(min_length=32, max_length=128)
    otp: str = Field(min_length=6, max_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateCurrentUserRequest(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=64)
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    about: str | None = Field(default=None, max_length=256)
    is_private: bool | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, username: str | None) -> str | None:
        if username is None:
            return username
        return validate_username_rules(username)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, password: str) -> str:
        return validate_password_rules(password)

    @model_validator(mode="after")
    def validate_confirmation(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New passwords do not match.")
        return self


class UsernameAvailabilityResponse(BaseModel):
    username: str
    available: bool


class UpdateSetupRequest(BaseModel):
    step: int = Field(ge=1, le=2)
    completed: bool = False


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    username: str
    display_name: str | None
    about: str | None
    profile_picture_url: str | None
    profile_picture_updated_at: datetime | None
    setup_step: int
    setup_completed: bool
    is_private: bool
    date_of_birth: date
    location: str | None
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PublicUserResponse(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None
    about: str | None
    profile_picture_url: str | None
    profile_picture_updated_at: datetime | None
    is_private: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthSessionResponse(BaseModel):
    id: uuid.UUID
    device_label: str
    browser: str | None
    operating_system: str | None
    created_at: datetime
    last_active_at: datetime
    current: bool


class ProfilePictureUploadUrlRequest(BaseModel):
    content_type: str = Field(min_length=1, max_length=100)


class ProfilePictureUploadUrlResponse(BaseModel):
    upload_url: str
    public_url: str
    object_key: str


class ProfilePictureConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1, max_length=512)


class ProfilePictureConfirmResponse(BaseModel):
    profile_picture_url: str
    profile_picture_updated_at: datetime
