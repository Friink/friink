import json

from fastapi.testclient import TestClient

from api.index import app
from app.config import Settings, get_settings
from app.services import auth_debug


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
