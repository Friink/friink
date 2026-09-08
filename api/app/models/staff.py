import hashlib
import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Table, Column, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


role_permissions = Table(
    "role_permissions", Base.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("staff_roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("staff_permissions.id", ondelete="CASCADE"), primary_key=True),
)

user_roles = Table(
    "user_roles", Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("staff_roles.id", ondelete="CASCADE"), primary_key=True),
)


class StaffPermission(Base):
    __tablename__ = "staff_permissions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StaffRole(Base):
    __tablename__ = "staff_roles"
    __table_args__ = (UniqueConstraint("key", name="uq_staff_roles_key"), UniqueConstraint("display_name", name="uq_staff_roles_display_name"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    permissions = relationship("StaffPermission", secondary=role_permissions)


class UserPermissionGrant(Base):
    __tablename__ = "user_permission_grants"
    __table_args__ = (UniqueConstraint("user_id", "permission_id", name="uq_user_permission_grant"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff_permissions.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    permission = relationship("StaffPermission")


class PrivilegedStaffSession(Base):
    __tablename__ = "privileged_staff_sessions"
    __table_args__ = (Index("ix_privileged_staff_sessions_user_active", "user_id", "revoked_at"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[bytes] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def new_token() -> str:
        return secrets.token_urlsafe(32)
