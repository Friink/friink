from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.auth import SignupRequest, UpdateCurrentUserRequest, validate_minimum_age, validate_password_rules, validate_username_rules


def test_password_requires_complexity() -> None:
    with pytest.raises(ValueError):
        validate_password_rules("password")
    with pytest.raises(ValueError):
        validate_password_rules("Password 1!")
    assert validate_password_rules("Password1!") == "Password1!"


def test_username_allows_documented_characters_only() -> None:
    assert validate_username_rules("friink.user-1_ok") == "friink.user-1_ok"
    with pytest.raises(ValueError):
        validate_username_rules("friink user")
    with pytest.raises(ValueError):
        validate_username_rules("friink@user")


def test_age_validation_requires_thirteen_years() -> None:
    today = date(2026, 8, 27)
    assert validate_minimum_age(date(2013, 8, 27), today=today) == date(2013, 8, 27)
    with pytest.raises(ValueError):
        validate_minimum_age(date(2013, 8, 28), today=today)


def test_signup_schema_validates_age() -> None:
    with pytest.raises(ValidationError):
        SignupRequest(
            email="user@example.com",
            username="friink",
            password="Password1!",
            date_of_birth=date.today(),
        )


def test_update_current_user_schema_validates_username() -> None:
    assert UpdateCurrentUserRequest(username="friink.user-1_ok").username == "friink.user-1_ok"
    with pytest.raises(ValidationError):
        UpdateCurrentUserRequest(username="friink user")


def test_update_current_user_schema_validates_profile_fields() -> None:
    assert UpdateCurrentUserRequest(display_name="Alex", about="Short about.").about == "Short about."
    with pytest.raises(ValidationError):
        UpdateCurrentUserRequest(display_name="")
    with pytest.raises(ValidationError):
        UpdateCurrentUserRequest(about="x" * 257)
