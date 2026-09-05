from datetime import UTC, datetime, timedelta
import hashlib
import secrets
import string

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.otp import OtpCode, OtpPurpose
from app.models.user import User
from app.models.signup_reservation import SignupReservation

OTP_TTL = timedelta(minutes=4)
OTP_MAX_ATTEMPTS = 5


def _hash(code: str) -> bytes:
    return hashlib.sha256(code.encode("ascii")).digest()


def issue_otp(session: Session, user: User, purpose: OtpPurpose, *, login_challenge_id=None, email_change_request_id=None) -> str:
    session.execute(update(OtpCode).where(OtpCode.user_id == user.id, OtpCode.purpose == purpose, OtpCode.consumed.is_(False)).values(consumed=True))
    code = _new_code()
    session.add(OtpCode(user_id=user.id, otp_hash=_hash(code), purpose=purpose, expires_at=datetime.now(UTC) + OTP_TTL, max_attempts=OTP_MAX_ATTEMPTS, login_challenge_id=login_challenge_id, email_change_request_id=email_change_request_id))
    session.flush()
    return code


def issue_login_otp(session: Session, user: User, challenge_id) -> str:
    return issue_otp(session, user, OtpPurpose.login, login_challenge_id=challenge_id)


def issue_email_change_otp(session: Session, user: User, request_id) -> str:
    return issue_otp(session, user, OtpPurpose.email_change, email_change_request_id=request_id)


def _new_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def issue_signup_otp(session: Session, reservation: SignupReservation) -> str:
    session.execute(
        update(OtpCode)
        .where(
            OtpCode.signup_reservation_id == reservation.id,
            OtpCode.purpose == OtpPurpose.signup,
            OtpCode.consumed.is_(False),
        )
        .values(consumed=True)
    )
    code = _new_code()
    session.add(
        OtpCode(
            signup_reservation_id=reservation.id,
            otp_hash=_hash(code),
            purpose=OtpPurpose.signup,
            expires_at=datetime.now(UTC) + OTP_TTL,
            max_attempts=OTP_MAX_ATTEMPTS,
        )
    )
    session.flush()
    return code


def verify_otp(session: Session, user: User, code: str, purpose: OtpPurpose, *, login_challenge_id=None, email_change_request_id=None) -> bool:
    conditions = [OtpCode.user_id == user.id, OtpCode.purpose == purpose, OtpCode.consumed.is_(False)]
    if login_challenge_id is not None:
        conditions.append(OtpCode.login_challenge_id == login_challenge_id)
    if email_change_request_id is not None:
        conditions.append(OtpCode.email_change_request_id == email_change_request_id)
    record = session.execute(select(OtpCode).where(*conditions).order_by(OtpCode.created_at.desc()).with_for_update()).scalar_one_or_none()
    if not record or record.expires_at <= datetime.now(UTC) or record.attempt_count >= record.max_attempts:
        return False
    record.attempt_count += 1
    if secrets.compare_digest(record.otp_hash, _hash(code.strip().upper())):
        record.consumed = True
        return True
    if record.attempt_count >= record.max_attempts:
        record.consumed = True
    return False


def verify_login_otp(session: Session, user: User, challenge_id, code: str) -> bool:
    return verify_otp(session, user, code, OtpPurpose.login, login_challenge_id=challenge_id)


def verify_email_change_otp(session: Session, user: User, request_id, code: str) -> bool:
    return verify_otp(session, user, code, OtpPurpose.email_change, email_change_request_id=request_id)


def verify_signup_otp(session: Session, reservation: SignupReservation, code: str) -> bool:
    record = session.execute(
        select(OtpCode)
        .where(
            OtpCode.signup_reservation_id == reservation.id,
            OtpCode.purpose == OtpPurpose.signup,
            OtpCode.consumed.is_(False),
        )
        .order_by(OtpCode.created_at.desc())
        .with_for_update()
    ).scalar_one_or_none()
    if not record or record.expires_at <= datetime.now(UTC) or record.attempt_count >= record.max_attempts:
        return False
    record.attempt_count += 1
    if secrets.compare_digest(record.otp_hash, _hash(code.strip().upper())):
        record.consumed = True
        return True
    if record.attempt_count >= record.max_attempts:
        record.consumed = True
    return False
async def send_otp(user: User, otp_code: str, purpose: OtpPurpose) -> None:
    raise NotImplementedError("OTP delivery will be wired once email is configured")
