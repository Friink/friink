from datetime import datetime
from datetime import date

from pydantic import BaseModel, EmailStr
from pydantic import field_validator

from app.schemas.auth import validate_minimum_age


class BetterAuthUserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    username: str | None
    email_verified: bool
    onboarding_status: str | None


class BetterAuthSessionResponse(BaseModel):
    authenticated: bool = True
    user: BetterAuthUserResponse
    expires_at: datetime


class BetterAuthProfileProvisionRequest(BaseModel):
    id: str
    email: EmailStr
    name: str
    username: str
    date_of_birth: date

    @field_validator("date_of_birth")
    @classmethod
    def validate_age(cls, value: date) -> date:
        return validate_minimum_age(value)
