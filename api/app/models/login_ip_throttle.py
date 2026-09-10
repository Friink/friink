from datetime import datetime

from sqlalchemy import DateTime, Integer, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LoginIpThrottle(Base):
    """Server-side secondary throttle shared across authentication endpoints."""

    __tablename__ = "login_ip_throttles"

    key_hash: Mapped[bytes] = mapped_column(LargeBinary(length=32), primary_key=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cooldown_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
