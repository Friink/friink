import re
import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


def validate_password_rules(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if any(character.isspace() for character in password):
        raise ValueError("Password must not contain spaces")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least 1 uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least 1 lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must include at least 1 number")
    if not re.search(r"[^A-Za-z0-9\s]", password):
        raise ValueError("Password must include at least 1 special character")
    return password


def validate_username_rules(username: str) -> str:
    if " " in username or not USERNAME_PATTERN.fullmatch(username):
        raise ValueError("Username may contain only letters, numbers, '-', '_', and '.' with no spaces")
    return username


def validate_minimum_age(date_of_birth: date, minimum_age: int = 13, today: date | None = None) -> date:
    today = today or date.today()
    age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    if age < minimum_age:
        raise ValueError("User must be at least 13 years old")
    return date_of_birth


class SignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=64)
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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    username: str
    date_of_birth: date
    location: str | None
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
