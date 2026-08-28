import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    about: Mapped[str | None] = mapped_column(String(256), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    otp_codes = relationship("OtpCode", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    sent_follow_requests = relationship(
        "FollowRequest",
        foreign_keys="FollowRequest.requester_id",
        back_populates="requester",
        cascade="all, delete-orphan",
    )
    received_follow_requests = relationship(
        "FollowRequest",
        foreign_keys="FollowRequest.recipient_id",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )
