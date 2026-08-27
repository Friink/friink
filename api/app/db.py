from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine: AsyncEngine | None = None
SessionLocal: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global engine
    if engine is None:
        settings = get_settings()
        engine = create_async_engine(
            settings.async_database_url,
            pool_pre_ping=True,
            poolclass=NullPool,
            connect_args=settings.async_connect_args,
        )
    return engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global SessionLocal
    if SessionLocal is None:
        SessionLocal = async_sessionmaker(get_engine(), expire_on_commit=False)
    return SessionLocal


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session
