from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global engine
    if engine is None:
        settings = get_settings()
        engine_options = {
            "pool_pre_ping": settings.database_pool_pre_ping,
            "connect_args": settings.async_connect_args,
        }
        if settings.database_pooling_enabled:
            engine_options.update({
                "poolclass": QueuePool,
                "pool_size": settings.database_pool_size,
                "max_overflow": settings.database_max_overflow,
                "pool_timeout": settings.database_pool_timeout_seconds,
                "pool_recycle": settings.database_pool_recycle_seconds,
                "pool_use_lifo": True,
            })
        else:
            engine_options["poolclass"] = NullPool
        engine = create_engine(settings.async_database_url, **engine_options)
    return engine


def get_session_factory() -> sessionmaker[Session]:
    global SessionLocal
    if SessionLocal is None:
        SessionLocal = sessionmaker(get_engine(), expire_on_commit=False)
    return SessionLocal


async def get_session() -> AsyncGenerator[Session, None]:
    with get_session_factory()() as session:
        yield session
