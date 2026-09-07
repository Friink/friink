"""Local test bootstrap with an isolated database fallback.

CI or an explicitly configured DATABASE_URL keeps its normal database path.
When neither is present, integration tests use a per-process SQLite file so a
fresh checkout can run the maintained suite without touching staging data.
"""

from __future__ import annotations

import os
from pathlib import Path
import tempfile
from datetime import UTC, datetime
import uuid


_created_database: Path | None = None

if not os.getenv("DATABASE_URL", "").strip():
    _created_database = Path(tempfile.gettempdir()) / f"friink-pytest-{os.getpid()}.sqlite3"
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{_created_database}"
    os.environ.setdefault("JWT_SECRET_KEY", "local-pytest-secret-32-bytes")
    os.environ.setdefault("ENVIRONMENT", "test")
    os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")


def pytest_sessionstart(session) -> None:
    from sqlalchemy import event

    import app.models  # noqa: F401 - register every model with Base.metadata
    from app.db import Base, get_engine

    engine = get_engine()
    if engine.dialect.name != "sqlite":
        return

    def configure_sqlite(connection, _record) -> None:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.create_function("char_length", 1, len)

    event.listen(engine, "connect", configure_sqlite)

    def normalize_loaded_datetimes(target, _context, _attrs=None) -> None:
        for key, value in vars(target).items():
            if isinstance(value, datetime) and value.tzinfo is None:
                setattr(target, key, value.replace(tzinfo=UTC))

    event.listen(Base, "load", normalize_loaded_datetimes, propagate=True)
    event.listen(Base, "refresh", normalize_loaded_datetimes, propagate=True)
    Base.metadata.create_all(engine)

    from app.db import get_session_factory
    from app.models.reserved_username import ReservedUsername

    with get_session_factory()() as session:
        if session.query(ReservedUsername).filter(ReservedUsername.username_key == "admin").first() is None:
            session.add(
                ReservedUsername(
                    id=uuid.uuid4(),
                    username_key="admin",
                    reason="system",
                )
            )
            session.commit()


def pytest_sessionfinish(session, exitstatus) -> None:
    if _created_database is not None:
        _created_database.unlink(missing_ok=True)
