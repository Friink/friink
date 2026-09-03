from app.models.user import User


class EmailService:
    async def send_signup_otp(self, email: str, otp_code: str) -> None:
        # Provider-neutral seam. Delivery is intentionally deferred by the
        # architecture document; the durable reservation/OTP contract is
        # ready for a provider without exposing the code to API callers.
        return None

    async def send_registration_successful(self, user: User) -> None:
        return None
