import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AuthRefreshAttempt(Base):
    """Durable, redacted diagnostics for each refresh HTTP attempt."""

    __tablename__ = "auth_refresh_attempts"
    __table_args__ = (
        Index("ix_auth_refresh_attempts_created_at", "created_at"),
        Index("ix_auth_refresh_attempts_operation_id", "refresh_operation_id"),
        Index("ix_auth_refresh_attempts_session_created", "session_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    refresh_operation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    client_tab_id_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_sessions.id", ondelete="SET NULL"), nullable=True)
    account_slot_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    failure_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exception_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    deployment_sha: Mapped[str] = mapped_column(String(128), nullable=False)
    slot_header_present: Mapped[bool] = mapped_column(Boolean, nullable=False)
    expected_slot_cookie_present: Mapped[bool] = mapped_column(Boolean, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
