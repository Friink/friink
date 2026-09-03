import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class OtpPurpose(str, enum.Enum):
    signup = "signup"
    login = "login"
    email_change = "email_change"
    password_recovery = "password_recovery"
    device_enrollment = "device_enrollment"
    staff_access = "staff_access"


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    signup_reservation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("signup_reservations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    otp_hash: Mapped[bytes] = mapped_column(LargeBinary(length=32), nullable=False)
    purpose: Mapped[OtpPurpose] = mapped_column(Enum(OtpPurpose, name="otp_purpose"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default="5")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="otp_codes")
    signup_reservation = relationship("SignupReservation", back_populates="otp_codes")
