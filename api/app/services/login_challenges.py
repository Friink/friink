from datetime import UTC, datetime, timedelta
import base64
import hashlib
import hmac
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.auth_challenge import LoginChallenge
from app.models.otp import OtpPurpose
from app.models.user import User
from app.services.otp import issue_login_otp, verify_login_otp

LOGIN_CHALLENGE_TTL = timedelta(minutes=4)


def hash_challenge_token(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii")).digest()


def create_login_challenge(
    session: Session, user: User, device_id, settings: Settings
) -> tuple[LoginChallenge, str, str]:
    raw_token = secrets.token_urlsafe(32)
    challenge = LoginChallenge(
        token_hash=hash_challenge_token(raw_token),
        user_id=user.id,
        device_id=device_id,
        expires_at=datetime.now(UTC) + LOGIN_CHALLENGE_TTL,
    )
    session.add(challenge)
    session.flush()
    otp_code = issue_login_otp(session, user, challenge.id)
    return challenge, raw_token, otp_code


def get_login_challenge(session: Session, raw_token: str) -> LoginChallenge | None:
    return session.execute(
        select(LoginChallenge).where(LoginChallenge.token_hash == hash_challenge_token(raw_token))
    ).scalar_one_or_none()


def verify_login_challenge(session: Session, challenge: LoginChallenge, user: User, code: str) -> bool:
    if challenge.consumed_at is not None or challenge.expires_at <= datetime.now(UTC):
        return False
    return verify_login_otp(session, user, challenge.id, code)


def derive_pending_device_identifier(raw_challenge_token: str, settings: Settings) -> str:
    digest = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        f"friink-device:{raw_challenge_token}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
