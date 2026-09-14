from html import escape
import logging

import httpx

from app.config import Settings
from app.models.user import User


logger = logging.getLogger(__name__)


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
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "resend_email_rejected status=%s response=%s",
                exc.response.status_code,
                exc.response.text[:500],
            )
            raise EmailDeliveryError("Email delivery failed.") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("resend_email_request_failed error=%s", type(exc).__name__)
            raise EmailDeliveryError("Email delivery failed.") from exc

    def _from_address(self, purpose: str) -> str:
        domain = self.settings.resend_from_domain.strip().lstrip("@").lower()
        alias = FROM_ALIASES[purpose]
        if not domain:
            raise EmailDeliveryError("Email sender domain is not configured.")
        return f"{alias}@{domain}"

    async def send_registration_successful(self, user: User) -> None:
        return None

    async def send_password_reset(self, email: str, reset_url: str) -> None:
        if not self.settings.resend_api_key:
            raise EmailDeliveryError("Email delivery is not configured.")
        from_address = self._from_address("security")
        if self.settings.resend_from_name.strip():
            from_address = f"{self.settings.resend_from_name.strip()} <{from_address}>"
        payload = {
            "from": from_address,
            "to": [email],
            "subject": "Reset your Friink password",
            "html": f"<p>We received a request to reset your Friink password.</p><p><a href=\"{escape(reset_url)}\">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p>",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {self.settings.resend_api_key}"}, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "resend_email_rejected status=%s response=%s",
                exc.response.status_code,
                exc.response.text[:500],
            )
            raise EmailDeliveryError("Email delivery failed.") from exc

    async def send_login_link(self, email: str, login_url: str) -> None:
        if not self.settings.resend_api_key:
            raise EmailDeliveryError("Email delivery is not configured.")
        from_address = self._from_address("security")
        if self.settings.resend_from_name.strip():
            from_address = f"{self.settings.resend_from_name.strip()} <{from_address}>"
        payload = {
            "from": from_address,
            "to": [email],
            "subject": "Sign in to Friink",
            "html": (
                "<p>We received a request to sign in to Friink with this email address.</p>"
                f"<p><a href=\"{escape(login_url)}\">Sign in to Friink</a></p>"
                "<p>This link expires in 15 minutes and can only be used once. "
                "If you did not request this, you can ignore this email.</p>"
            ),
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {self.settings.resend_api_key}"}, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning("resend_email_rejected status=%s response=%s", exc.response.status_code, exc.response.text[:500])
            raise EmailDeliveryError("Email delivery failed.") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("resend_email_request_failed error=%s", type(exc).__name__)
            raise EmailDeliveryError("Email delivery failed.") from exc

    async def send_failed_login_alert(self, email: str, reset_url: str) -> None:
        if not self.settings.resend_api_key:
            raise EmailDeliveryError("Email delivery is not configured.")
        from_address = self._from_address("security")
        if self.settings.resend_from_name.strip():
            from_address = f"{self.settings.resend_from_name.strip()} <{from_address}>"
        payload = {
            "from": from_address,
            "to": [email],
            "subject": "Security alert for your Friink account",
            "html": (
                "<p>We detected several unsuccessful sign-in attempts to your Friink account.</p>"
                "<p>If you made these attempts, you can ignore this message. "
                "If you don\u2019t recognize them, reset your password now.</p>"
                f"<p><a href=\"{escape(reset_url)}\">Reset password</a></p>"
                "<p>For your security, this link expires in 30 minutes and can only be used once.</p>"
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
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "resend_email_rejected status=%s response=%s",
                exc.response.status_code,
                exc.response.text[:500],
            )
            raise EmailDeliveryError("Email delivery failed.") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("resend_email_request_failed error=%s", type(exc).__name__)
            raise EmailDeliveryError("Email delivery failed.") from exc
