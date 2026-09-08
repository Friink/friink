from pathlib import Path
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401
from app.config import Settings
from app.db import Base
from app.models.reserved_username import ReservedUsername
from app.models.security_event import SecurityEvent, SecurityEventType
from app.models.user import User
from app.schemas.auth import SignupRequest
from scripts import bootstrap_admin
from app.services.auth import build_user_from_signup
from app.services.security import verify_password


VALID_PASSWORD = "Valid1!x"


@pytest.fixture
def bootstrap_settings() -> Settings:
    db_path = Path.cwd() / f".bootstrap-{uuid.uuid4().hex}.sqlite3"
    url = f"sqlite+pysqlite:///{db_path}"
    engine = create_engine(url, poolclass=NullPool)
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _record) -> None:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.create_function("char_length", 1, len)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(ReservedUsername(username_key="admin", reason="system"))
        session.commit()
    engine.dispose()
    settings = Settings(
        _env_file=None,
        DATABASE_URL=url,
        DATABASE_TARGET="test",
        ENVIRONMENT="test",
        FRONTEND_URL="http://localhost:3000",
        JWT_SECRET_KEY="bootstrap-test-secret-32-bytes-long",
    )
    yield settings
    db_path.unlink(missing_ok=True)


def _engine(settings: Settings):
    return create_engine(settings.async_database_url, poolclass=NullPool)


def test_first_run_creates_login_ready_staff_account(bootstrap_settings: Settings) -> None:
    bootstrap_admin.bootstrap(bootstrap_settings, VALID_PASSWORD)
    with Session(_engine(bootstrap_settings)) as session:
        user = session.execute(select(User).where(User.email == "admin@friink.com")).scalar_one()
        assert user.is_staff is True
        assert user.is_verified is True
        assert user.lifecycle_status == "active"
        assert verify_password(VALID_PASSWORD, user.password_hash)
        event = session.execute(select(SecurityEvent).where(SecurityEvent.user_id == user.id)).scalar_one()
        assert event.event_type is SecurityEventType.bootstrap_succeeded
        assert "password" not in str(event.payload).lower()


def test_rerun_is_refused_without_mutation(bootstrap_settings: Settings) -> None:
    bootstrap_admin.bootstrap(bootstrap_settings, VALID_PASSWORD)
    with pytest.raises(bootstrap_admin.BootstrapError) as error:
        bootstrap_admin.bootstrap(bootstrap_settings, VALID_PASSWORD)
    assert error.value.reason == "repeat_bootstrap"
    with Session(_engine(bootstrap_settings)) as session:
        assert session.query(User).count() == 1
        refusal = session.execute(select(SecurityEvent).where(SecurityEvent.event_type == SecurityEventType.bootstrap_refused)).scalar_one()
        assert refusal.payload["reason"] == "repeat_bootstrap"


@pytest.mark.parametrize("identity, reason", [("email", "email_conflict"), ("username", "username_conflict")])
def test_identity_conflicts_are_refused(bootstrap_settings: Settings, identity: str, reason: str) -> None:
    with Session(_engine(bootstrap_settings)) as session:
        data = SignupRequest(
            email="admin@friink.com" if identity == "email" else "other@friink.com",
            username="admin" if identity == "username" else "other",
            display_name="Existing",
            password=VALID_PASSWORD,
            date_of_birth="1990-01-01",
        )
        session.add(build_user_from_signup(data))
        session.commit()
    with pytest.raises(bootstrap_admin.BootstrapError) as error:
        bootstrap_admin.bootstrap(bootstrap_settings, VALID_PASSWORD)
    assert error.value.reason == reason


def test_invalid_password_never_opens_database_or_creates_account(bootstrap_settings: Settings) -> None:
    with pytest.raises(ValueError):
        bootstrap_admin.bootstrap(bootstrap_settings, "weak")
    with Session(_engine(bootstrap_settings)) as session:
        assert session.query(User).count() == 0


def test_ambiguous_environment_is_rejected_before_write(bootstrap_settings: Settings) -> None:
    args = bootstrap_admin.parse_args(["--environment", "staging"])
    with pytest.raises(bootstrap_admin.BootstrapError):
        bootstrap_admin.load_target_settings(args)


def test_concurrent_runs_create_one_complete_account(bootstrap_settings: Settings) -> None:
    def run() -> str:
        try:
            bootstrap_admin.bootstrap(bootstrap_settings, VALID_PASSWORD)
            return "success"
        except bootstrap_admin.BootstrapError as error:
            return error.reason

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _item: run(), range(2)))
    assert results.count("success") == 1
    assert len(results) == 2
    with Session(_engine(bootstrap_settings)) as session:
        user = session.execute(select(User).where(User.email == "admin@friink.com")).scalar_one()
        assert user.is_staff and user.is_verified and user.lifecycle_status == "active"


def test_main_confirmation_mismatch_returns_nonzero_without_bootstrap(monkeypatch: pytest.MonkeyPatch, bootstrap_settings: Settings) -> None:
    monkeypatch.setattr(bootstrap_admin, "load_target_settings", lambda _args: bootstrap_settings)
    prompts = iter([VALID_PASSWORD, "Different1!"])
    monkeypatch.setattr(bootstrap_admin, "getpass", lambda _prompt: next(prompts))
    assert bootstrap_admin.main(["--environment", "test"]) == 2
    with Session(_engine(bootstrap_settings)) as session:
        assert session.query(User).count() == 0
