from app.models.otp import OtpPurpose
from app.models.user import User


async def generate_otp(user: User, purpose: OtpPurpose) -> str:
    raise NotImplementedError("OTP generation will be wired once email is configured")


async def send_otp(user: User, otp_code: str, purpose: OtpPurpose) -> None:
    raise NotImplementedError("OTP delivery will be wired once email is configured")


async def verify_otp(user: User, otp_code: str, purpose: OtpPurpose) -> bool:
    raise NotImplementedError("OTP verification will be wired once email is configured")
