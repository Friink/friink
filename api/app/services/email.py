from html import escape

import httpx

from app.config import Settings
from app.models.user import User


class EmailDeliveryError(RuntimeError):
    """Raised when a configured email provider cannot accept a message."""


FROM_ALIASES = {
    "otp": "noreply",
    "welcome": "hello",
    "security": "security",
}


class EmailService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send_signup_otp(self, email: str, otp_code: str) -> None:
        await self._send_otp(email, otp_code, "verify your Friink email address")

    async def send_login_otp(self, email: str, otp_code: str) -> None:
        await self._send_otp(email, otp_code, "approve this Friink login")

    async def send_email_change_otp(self, email: str, otp_code: str) -> None:
        await self._send_otp(email, otp_code, "confirm your new Friink email address")

    async def send_lifecycle_otp(self, email: str, otp_code: str) -> None:
        await self._send_otp(email, otp_code, "confirm your Friink account reactivation or deletion request")

    async def _send_otp(self, email: str, otp_code: str, action: str) -> None:
        if not self.settings.resend_api_key:
            raise EmailDeliveryError("Email delivery is not configured.")

        from_address = self._from_address("otp")
        if self.settings.resend_from_name.strip():
            from_address = f"{self.settings.resend_from_name.strip()} <{from_address}>"

        payload = {
            "from": from_address,
            "to": [email],
            "subject": "Your Friink verification code",
            "html": (
                f"<p>Use this code to {escape(action)}:</p>"
                f"<p style=\"font-size: 24px; font-weight: 700; letter-spacing: 0.18em;\">{escape(otp_code)}</p>"
                "<p>This code expires in 4 minutes and can only be used once.</p>"
            ),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {self.settings.resend_api_key}"},
                    json=payload,
                )
                response.raise_for_status()
        except (httpx.HTTPError, ValueError) as exc:
            raise EmailDeliveryError("Email delivery failed.") from exc

    def _from_address(self, purpose: str) -> str:
        domain = self.settings.resend_from_domain.strip().lstrip("@").lower()
        alias = FROM_ALIASES[purpose]
        if not domain:
            raise EmailDeliveryError("Email sender domain is not configured.")
        return f"{alias}@{domain}"

    async def send_registration_successful(self, user: User) -> None:
        return None
