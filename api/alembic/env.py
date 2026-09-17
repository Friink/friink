from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.engine import Connection

from app.config import get_settings
from app.db import Base
from app.models.professional_registration import ProfessionalRegistration  # noqa: F401
from app.models import AccountSessionSlot, AuthSession, FollowRequest, LoginChallenge, OtpCode, PasswordResetToken, Post, PostLike, PostMedia, PostSave, ProgressiveAuthFlow, RecognizedDevice, RefreshToken, User  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_object(object_, name, type_, reflected, compare_to):
    # Search indexes are PostgreSQL-specific expression indexes created by
    # migration. They are intentionally not part of SQLite test metadata.
    if type_ == "index" and name and name.startswith(("ix_users_search_", "ix_posts_search_", "ix_messages_search_")):
        return False
    return True

# Migration convention: any migration that intentionally invalidates existing
# auth sessions/tokens must include a comment beginning with
# "SESSION INVALIDATION:" explaining the deliberate user-facing impact.


def get_url() -> str:
    return get_settings().async_database_url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    settings = get_settings()
    connectable = engine_from_config(
        {"sqlalchemy.url": settings.async_database_url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=settings.async_connect_args,
    )
    with connectable.connect() as connection:
        do_run_migrations(connection)
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
