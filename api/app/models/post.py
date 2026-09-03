import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, query_expression, relationship

from app.db import Base
from app.services.post_ids import generate_public_id


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
        CheckConstraint("like_count >= 0", name="ck_posts_like_count_nonnegative"),
        CheckConstraint("star_count >= 0", name="ck_posts_star_count_nonnegative"),
        UniqueConstraint("public_id", name="uq_posts_public_id"),
        Index("ix_posts_public_id", "public_id", unique=False),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_id: Mapped[str] = mapped_column(String(8), nullable=False, default=generate_public_id)
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
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    star_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    user = relationship("User", back_populates="posts")
    parent_post = relationship("Post", remote_side=[id], foreign_keys=[parent_post_id], back_populates="replies")
    replies = relationship("Post", foreign_keys=[parent_post_id], back_populates="parent_post")
    quoted_post = relationship("Post", remote_side=[id], foreign_keys=[quoted_post_id])
    media = relationship("PostMedia", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    stars = relationship("PostStar", back_populates="post", cascade="all, delete-orphan")
    reply_count: Mapped[int] = query_expression()
    quote_count: Mapped[int] = query_expression()


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="media")


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_likes_post_user"),
        Index("ix_post_likes_user_created", "user_id", "created_at"),
        Index("ix_post_likes_post_created", "post_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="likes")
    user = relationship("User")


class PostStar(Base):
    __tablename__ = "post_stars"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_stars_post_user"),
        Index("ix_post_stars_user_created", "user_id", "created_at"),
        Index("ix_post_stars_post_created", "post_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="stars")
    user = relationship("User")
