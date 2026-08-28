from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global engine
    if engine is None:
        settings = get_settings()
        engine = create_engine(
            settings.async_database_url,
            pool_pre_ping=True,
            poolclass=NullPool,
            connect_args=settings.async_connect_args,
        )
    return engine


def get_session_factory() -> sessionmaker[Session]:
    global SessionLocal
    if SessionLocal is None:
        SessionLocal = sessionmaker(get_engine(), expire_on_commit=False)
    return SessionLocal


async def get_session() -> AsyncGenerator[Session, None]:
    with get_session_factory()() as session:
        yield session
