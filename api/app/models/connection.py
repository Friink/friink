import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class FollowRequestStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    canceled = "canceled"


class FollowRequest(Base):
    __tablename__ = "follow_requests"
    __table_args__ = (
        CheckConstraint("requester_id <> recipient_id", name="ck_follow_requests_not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[FollowRequestStatus] = mapped_column(
        Enum(FollowRequestStatus, name="follow_request_status"),
        nullable=False,
        default=FollowRequestStatus.pending,
        server_default=FollowRequestStatus.pending.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requester = relationship("User", foreign_keys=[requester_id], back_populates="sent_follow_requests")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_follow_requests")
