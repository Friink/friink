"""Safely create the reserved Friink superadmin account."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from getpass import getpass
from urllib.parse import urlsplit

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models.identity_history import UserEmailHistory, UserUsernameHistory
from app.models.reserved_username import ReservedUsername
from app.models.security_event import SecurityEventType
from app.models.user import User
from app.schemas.auth import SignupRequest, validate_password_rules
from app.services.auth import (
    RESERVED_SUPERADMIN_EMAIL,
    RESERVED_SUPERADMIN_USERNAME_KEY,
    build_user_from_signup,
)
from app.services.security_events import record_bootstrap_refusal, record_security_event

EXPECTED_FRONTENDS = {
    "staging": "https://staging.friink.com",
    "production": "https://friink.com",
    "test": "http://localhost:3000",
}
LOCK_KEY = 7_481_561_905


class BootstrapError(Exception):
    def __init__(self, message: str, *, reason: str, auditable: bool = True) -> None:
        super().__init__(message)
        self.reason = reason
        self.auditable = auditable


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", required=True, choices=tuple(EXPECTED_FRONTENDS))
    parser.add_argument("--env-file", help="Explicit settings file with matching ENVIRONMENT and DATABASE_TARGET.")
    return parser.parse_args(argv)


def load_target_settings(args: argparse.Namespace) -> Settings:
    settings = Settings(_env_file=args.env_file) if args.env_file else get_settings()
    environment = settings.environment.strip().casefold()
    target = settings.database_target.strip().casefold()
    frontend = str(settings.frontend_url).rstrip("/")
    if environment != args.environment or target != args.environment:
        raise BootstrapError("Target environment and database target must explicitly match.", reason="invalid_configuration")
    if frontend != EXPECTED_FRONTENDS[args.environment]:
        raise BootstrapError("Frontend URL does not match the target environment.", reason="invalid_configuration")
    if not settings.database_url.strip():
        raise BootstrapError("DATABASE_URL is required.", reason="invalid_configuration", auditable=False)
    parsed = urlsplit(settings.database_url)
    if args.environment in {"staging", "production"}:
        if parsed.scheme not in {"postgresql", "postgresql+psycopg"} or not parsed.hostname:
            raise BootstrapError("A remote PostgreSQL target is required.", reason="invalid_configuration")
        if parsed.hostname.lower() in {"localhost", "127.0.0.1", "::1"}:
            raise BootstrapError("Local database targets are not valid for staging or production.", reason="invalid_configuration")
    return settings


def _record_configuration_refusal(settings: Settings, environment: str) -> None:
    if not settings.database_url.strip() or settings.database_target.strip().casefold() != environment:
        return
    try:
        engine = create_engine(settings.async_database_url, connect_args=settings.async_connect_args)
        with engine.begin() as connection:
            with Session(bind=connection) as session:
                record_bootstrap_refusal(session, reason="invalid_configuration", environment=environment)
    except Exception:
        return
    finally:
        if "engine" in locals():
            engine.dispose()


def _record_refusal(settings: Settings, *, reason: str, environment: str) -> None:
    try:
        engine = create_engine(settings.async_database_url, connect_args=settings.async_connect_args)
        with engine.begin() as connection:
            with Session(bind=connection) as session:
                record_bootstrap_refusal(session, reason=reason, environment=environment)
    except Exception:
        return
    finally:
        if "engine" in locals():
            engine.dispose()


def _lock_bootstrap(session: Session) -> None:
    if session.get_bind().dialect.name == "postgresql":
        session.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": LOCK_KEY})
    else:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")


def _refuse(session: Session, *, reason: str, environment: str) -> None:
    record_bootstrap_refusal(session, reason=reason, environment=environment)
    raise BootstrapError("Bootstrap refused.", reason=reason)


def bootstrap(settings: Settings, password: str) -> None:
    validate_password_rules(password)
    environment = settings.environment.strip().casefold()
    engine = create_engine(settings.async_database_url, connect_args=settings.async_connect_args, isolation_level="SERIALIZABLE")
    try:
        with engine.begin() as connection:
            with Session(bind=connection) as session:
                _lock_bootstrap(session)
                if session.execute(select(User.id).where(User.is_staff.is_(True)).limit(1)).scalar_one_or_none():
                    _refuse(session, reason="repeat_bootstrap", environment=environment)
                if session.execute(select(User.id).where(func.lower(User.email) == RESERVED_SUPERADMIN_EMAIL)).scalar_one_or_none() is not None:
                    _refuse(session, reason="email_conflict", environment=environment)
                if session.execute(select(User.id).where(User.username_key == RESERVED_SUPERADMIN_USERNAME_KEY)).scalar_one_or_none() is not None:
                    _refuse(session, reason="username_conflict", environment=environment)
                reserved = session.execute(
                    select(ReservedUsername.id).where(
                        ReservedUsername.username_key == RESERVED_SUPERADMIN_USERNAME_KEY,
                        ReservedUsername.active.is_(True),
                    )
                ).scalar_one_or_none()
                if reserved is None:
                    _refuse(session, reason="invalid_configuration", environment=environment)

                data = SignupRequest(
                    email=RESERVED_SUPERADMIN_EMAIL,
                    username=RESERVED_SUPERADMIN_USERNAME_KEY,
                    display_name="Friink Admin",
                    password=password,
                    date_of_birth=date(1900, 1, 1),
                    location=None,
                )
                user = build_user_from_signup(data, is_staff=True, setup_step=2, setup_completed=True)
                session.add(user)
                session.flush()
                session.add(UserEmailHistory(user_id=user.id, email_value=user.email, event_type="created"))
                session.add(UserUsernameHistory(user_id=user.id, username_key=user.username_key, username_display=user.username, event_type="created"))
                record_security_event(
                    session,
                    event_type=SecurityEventType.bootstrap_succeeded,
                    event_key=f"bootstrap-succeeded:{user.id}",
                    user_id=user.id,
                    payload={"operation": "reserved_superadmin_bootstrap", "environment": environment, "identity": "reserved_admin"},
                    idempotent=True,
                )
        print("Created the initial staff account admin@friink.com (@admin).")
    except BootstrapError as exc:
        _record_refusal(settings, reason=exc.reason, environment=environment)
        raise
    except IntegrityError as exc:
        _record_refusal(settings, reason="identity_conflict", environment=environment)
        raise BootstrapError("Bootstrap conflicted with an existing identity; no account was created.", reason="identity_conflict") from exc
    finally:
        engine.dispose()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        settings = load_target_settings(args)
    except BootstrapError as exc:
        if "settings" in locals() and exc.auditable:
            _record_configuration_refusal(settings, args.environment)
        print(str(exc), file=sys.stderr)
        return 2
    password = getpass("Initial password for admin@friink.com: ")
    confirmation = getpass("Confirm initial password: ")
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr)
        return 2
    try:
        validate_password_rules(password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    try:
        bootstrap(settings, password)
    except BootstrapError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
