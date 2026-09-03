from datetime import date
import uuid

from sqlalchemy import delete, select

from app.db import get_session_factory
from app.models.otp import OtpCode, OtpPurpose
from app.models.user import User
from app.services.otp import issue_otp, verify_otp
from app.services.security import hash_password


def test_otp_is_hashed_single_use_and_new_issue_invalidates_previous() -> None:
    user_id = uuid.uuid4()
    with get_session_factory()() as session:
        user = User(
            id=user_id,
            email=f"otp-{user_id.hex}@example.com",
            username=f"otp_{user_id.hex[:20]}",
            username_key=f"otp_{user_id.hex[:20]}",
            password_hash=hash_password("Password1!"),
            date_of_birth=date(1990, 1, 1),
            is_verified=False,
        )
        session.add(user)
        session.flush()
        first = issue_otp(session, user, OtpPurpose.signup)
        first_record = session.execute(select(OtpCode).where(OtpCode.user_id == user_id)).scalar_one()
        assert first_record.otp_hash != first.encode()
        second = issue_otp(session, user, OtpPurpose.signup)
        assert second != first
        assert verify_otp(session, user, first, OtpPurpose.signup) is False
        assert verify_otp(session, user, second, OtpPurpose.signup) is True
        assert verify_otp(session, user, second, OtpPurpose.signup) is False
        session.rollback()
        session.execute(delete(User).where(User.id == user_id))
        session.commit()
