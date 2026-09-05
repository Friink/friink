import pytest

from app.config import Settings
from app.services.email import EmailDeliveryError, EmailService


class FakeResponse:
    def raise_for_status(self) -> None:
        return None


class FakeAsyncClient:
    payload: dict | None = None

    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        return None

    async def post(self, url: str, *, headers: dict[str, str], json: dict) -> FakeResponse:
        self.__class__.payload = {"url": url, "headers": headers, "json": json}
        return FakeResponse()


@pytest.mark.asyncio
async def test_resend_signup_otp_sends_server_side_payload(monkeypatch) -> None:
    monkeypatch.setattr("app.services.email.httpx.AsyncClient", FakeAsyncClient)
    settings = Settings(
        _env_file=None,
        JWT_SECRET_KEY="email-test-secret",
        RESEND_API_KEY="re_test_key",
        RESEND_FROM_EMAIL="onboarding@resend.dev",
        RESEND_FROM_NAME="Friink",
    )

    await EmailService(settings).send_signup_otp("person@example.com", "A1B2C3")

    assert FakeAsyncClient.payload == {
        "url": "https://api.resend.com/emails",
        "headers": {"Authorization": "Bearer re_test_key"},
        "json": {
            "from": "Friink <onboarding@resend.dev>",
            "to": ["person@example.com"],
            "subject": "Your Friink verification code",
            "html": "<p>Use this code to verify your Friink email address:</p><p style=\"font-size: 24px; font-weight: 700; letter-spacing: 0.18em;\">A1B2C3</p><p>This code expires in 4 minutes and can only be used once.</p>",
        },
    }


@pytest.mark.asyncio
async def test_resend_signup_otp_requires_api_key() -> None:
    settings = Settings(_env_file=None, JWT_SECRET_KEY="email-test-secret")

    with pytest.raises(EmailDeliveryError):
        await EmailService(settings).send_signup_otp("person@example.com", "A1B2C3")
