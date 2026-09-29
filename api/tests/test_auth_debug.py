import json
import uuid
from datetime import date

from fastapi.testclient import TestClient

from api.index import app
from app.config import Settings, get_settings
from app.db import get_session_factory
from app.models.user import User
from app.services import auth_debug
from app.services.security import hash_password
from sqlalchemy import delete


def test_account_diagnostics_are_structured_and_secret_free(monkeypatch, caplog) -> None:
    monkeypatch.setenv("AUTH_DEBUG_LOGGING_ENABLED", "true")
    caplog.set_level("INFO", logger="friink.auth")

    auth_debug.log_account_list_event(account_count=3, device_cookie_present=True)
    auth_debug.log_account_switch_event(result="failure", reason="slot_not_found")

    events = [json.loads(record.message) for record in caplog.records if record.name == "friink.auth"]
    assert [event["event"] for event in events[-2:]] == ["auth_account_list", "auth_account_switch"]
    assert events[-2]["account_count"] == 3
    assert events[-1]["reason"] == "slot_not_found"
    for event in events[-2:]:
        assert set(event) <= {"event", "account_count", "device_cookie_present", "result", "reason", "deployment_sha", "server_time"}
        assert "account_slot" not in event
        assert "token" not in event
        assert "password" not in event


def test_token_diagnostics_do_not_emit_internal_identifiers(monkeypatch, caplog) -> None:
    monkeypatch.setenv("AUTH_DEBUG_LOGGING_ENABLED", "true")
    caplog.set_level("INFO", logger="friink.auth")

    auth_debug.log_token_issued(flow="fresh_login", token_type="access", token="raw-token", user_id="user-id")
    auth_debug.log_refresh_token_event(event="refresh", flow="refresh_exchange", token_id="token-id", family_id="family-id", user_id="user-id", reason="test")

    events = [json.loads(record.message) for record in caplog.records if record.name == "friink.auth"]
    assert events[-2]["event"] == "auth_token_issued"
    assert events[-1]["event"] == "refresh"
    for event in events[-2:]:
        assert not {"user_id", "token_id", "family_id"}.intersection(event)
        assert "raw-token" not in json.dumps(event)


def test_refresh_requests_return_correlated_redacted_success_and_failure(monkeypatch, caplog) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        JWT_SECRET_KEY="refresh-diagnostics-test-secret",
        ENVIRONMENT="test",
        FRONTEND_URL="http://localhost:3000",
        LOGIN_RISK_OTP_ENABLED=False,
    )
    monkeypatch.setenv("VERCEL_GIT_COMMIT_SHA", "diagnostics-test-sha")
    caplog.set_level("INFO", logger="friink.auth")
    user_id = uuid.uuid4()
    email = f"refresh-diagnostics-{uuid.uuid4().hex}@example.com"
    username = f"refresh_diag_{uuid.uuid4().hex[:12]}"
    password = "Strong1!pass"
    with get_session_factory()() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                username=username,
                username_key=username.casefold(),
                password_hash=hash_password(password),
                date_of_birth=date(1990, 1, 1),
                is_verified=True,
            )
        )
        session.commit()

    try:
        client = TestClient(app)
        login = client.post("/auth/login", json={"identifier": email, "password": password})
        assert login.status_code == 200, login.text
        slot = login.json()["account_slot"]

        refreshed = client.post("/auth/refresh", headers={"X-Friink-Account-Slot": slot})
        assert refreshed.status_code == 200, refreshed.text
        success_request_id = refreshed.headers.get("X-Friink-Request-Id")
        assert success_request_id

        invalid_token = "diagnostic-only-invalid-refresh-token"
        client.cookies.set(f"friink_refresh_{slot}", invalid_token)
        failed = client.post("/auth/refresh", headers={"X-Friink-Account-Slot": slot})
        assert failed.status_code == 401, failed.text
        assert failed.json()["detail"]["code"] == "REFRESH_TOKEN_INVALID"
        failure_request_id = failed.headers.get("X-Friink-Request-Id")
        assert failure_request_id

        events = [
            json.loads(record.message)
            for record in caplog.records
            if record.name == "friink.auth" and '"event": "auth_refresh_request"' in record.message
        ]
        success = next(event for event in events if event["request_id"] == success_request_id)
        failure = next(event for event in events if event["request_id"] == failure_request_id)
        assert success["status_code"] == 200
        assert success["failure_class"] == "success"
        assert success["slot_header_present"] is True
        assert success["expected_slot_cookie_present"] is True
        assert failure["status_code"] == 401
        assert failure["failure_class"] == "REFRESH_TOKEN_INVALID"
        assert failure["deployment_sha"] == "diagnostics-test-sha"
        assert failure["slot_header_present"] is True
        assert failure["expected_slot_cookie_present"] is True
        assert slot not in json.dumps(events)
        assert invalid_token not in json.dumps(events)
    finally:
        with get_session_factory()() as session:
            session.execute(delete(User).where(User.id == user_id))
            session.commit()
        app.dependency_overrides.clear()


def test_auth_diagnostics_endpoint_requires_token_and_reports_effective_flags() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        JWT_SECRET_KEY="diagnostics-test-secret",
        ENVIRONMENT="test",
        FRONTEND_URL="http://localhost:3000",
        AUTH_DIAGNOSTICS_INTERNAL_TOKEN="diagnostics-secret",
        SIGNUP_OTP_ENABLED=False,
        LOGIN_RISK_OTP_ENABLED=False,
    )
    try:
        client = TestClient(app)
        assert client.get("/internal/auth/diagnostics").status_code == 404
        response = client.get("/internal/auth/diagnostics", headers={"X-Auth-Diagnostics-Token": "diagnostics-secret"})
        assert response.status_code == 200, response.text
        assert response.json()["signup_otp_enabled"] is False
        assert response.json()["login_risk_otp_enabled"] is False
        assert response.json()["otp_enabled"] is True
        assert "deployment_sha" in response.json()
    finally:
        app.dependency_overrides.clear()


def test_otp_flags_are_read_from_runtime_environment(monkeypatch) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", "runtime-env-diagnostics-secret")
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
    monkeypatch.setenv("SIGNUP_OTP_ENABLED", "false")
    monkeypatch.setenv("LOGIN_RISK_OTP_ENABLED", "false")
    get_settings.cache_clear()
    try:
        settings = get_settings()
        assert settings.signup_otp_enabled is False
        assert settings.login_risk_otp_enabled is False
    finally:
        get_settings.cache_clear()


def test_production_rejects_global_otp_disable() -> None:
    try:
        Settings(
            _env_file=None,
            JWT_SECRET_KEY="production-otp-guard-secret-32-bytes",
            ENVIRONMENT="production",
            FRONTEND_URL="https://friink.com",
            OTP_ENABLED=False,
        )
        raise AssertionError("production settings accepted OTP_ENABLED=false")
    except ValueError as exc:
        assert "OTP_ENABLED" in str(exc)
