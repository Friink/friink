import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class PostKind(str, PyEnum):
    POST = "post"
    QUOTE = "quote"
    REPLY = "reply"


def enum_values(enum: type[PyEnum]) -> list[str]:
    return [item.value for item in enum]


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        CheckConstraint("char_length(content) <= 512", name="ck_posts_content_max_length"),
        CheckConstraint("media_count >= 0 AND media_count <= 16", name="ck_posts_media_count_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[PostKind] = mapped_column(
        Enum(PostKind, name="post_kind", values_callable=enum_values),
        nullable=False,
        default=PostKind.POST,
        server_default=PostKind.POST.value,
    )
    parent_post_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id"), nullable=True, index=True)
    quoted_post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("posts.id"),
        nullable=True,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    media_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user = relationship("User", back_populates="posts")
    parent_post = relationship("Post", remote_side=[id], foreign_keys=[parent_post_id], back_populates="replies")
    replies = relationship("Post", foreign_keys=[parent_post_id], back_populates="parent_post")
    quoted_post = relationship("Post", remote_side=[id], foreign_keys=[quoted_post_id])
    media = relationship("PostMedia", back_populates="post", cascade="all, delete-orphan")


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="media")
