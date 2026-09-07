from functools import lru_cache
import json
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = Field(default="", alias="DATABASE_URL")
    frontend_url: AnyHttpUrl | str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    otp_enabled: bool = Field(default=True, alias="OTP_ENABLED")
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_active_kid: str = Field(default="default", alias="JWT_ACTIVE_KID")
    jwt_keys: str = Field(default="", alias="JWT_KEYS")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=30, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    refresh_token_reuse_grace_seconds: int = Field(default=60, alias="REFRESH_TOKEN_REUSE_GRACE_SECONDS")
    signup_otp_enabled: bool = Field(default=False, alias="SIGNUP_OTP_ENABLED")
    login_risk_otp_enabled: bool = Field(default=True, alias="LOGIN_RISK_OTP_ENABLED")
    resend_api_key: str = Field(default="", alias="RESEND_API_KEY")
    resend_from_domain: str = Field(default="", alias="RESEND_FROM_DOMAIN")
    resend_from_name: str = Field(default="Friink", alias="RESEND_FROM_NAME")
    r2_account_id: str = Field(default="", alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(default="", alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", alias="R2_SECRET_ACCESS_KEY")
    r2_bucket_name: str = Field(default="", alias="R2_BUCKET_NAME")
    r2_public_url: str = Field(default="", alias="R2_PUBLIC_URL")
    account_deletion_grace_days: int = Field(default=32, alias="ACCOUNT_DELETION_GRACE_DAYS")
    account_deletion_warning_days: int = Field(default=4, alias="ACCOUNT_DELETION_WARNING_DAYS")
    account_lifecycle_internal_token: str = Field(default="", alias="ACCOUNT_LIFECYCLE_INTERNAL_TOKEN")
    auth_diagnostics_internal_token: str = Field(default="", alias="AUTH_DIAGNOSTICS_INTERNAL_TOKEN")
    max_remembered_accounts_per_device: int = Field(default=4, alias="MAX_REMEMBERED_ACCOUNTS_PER_DEVICE")

    @model_validator(mode="after")
    def validate_lifecycle_timing(self) -> "Settings":
        if self.is_production and not self.otp_enabled:
            raise ValueError("OTP_ENABLED must remain true in production.")
        if self.account_deletion_grace_days <= 0:
            raise ValueError("ACCOUNT_DELETION_GRACE_DAYS must be positive.")
        if self.account_deletion_warning_days <= 0 or self.account_deletion_warning_days >= self.account_deletion_grace_days:
            raise ValueError("ACCOUNT_DELETION_WARNING_DAYS must be positive and shorter than the grace period.")
        if not 1 <= self.max_remembered_accounts_per_device <= 16:
            raise ValueError("MAX_REMEMBERED_ACCOUNTS_PER_DEVICE must be between 1 and 16.")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def jwt_verification_keys(self) -> dict[str, str]:
        keys = {"default": self.jwt_secret_key}
        if not self.jwt_keys.strip():
            return keys
        try:
            configured = json.loads(self.jwt_keys)
        except json.JSONDecodeError as exc:
            raise ValueError("JWT_KEYS must be a JSON object mapping key ids to secrets.") from exc
        if not isinstance(configured, dict) or any(not isinstance(k, str) or not isinstance(v, str) or not v for k, v in configured.items()):
            raise ValueError("JWT_KEYS must be a JSON object mapping non-empty key ids to secrets.")
        keys.update(configured)
        return keys

    @property
    def jwt_signing_key(self) -> str:
        key = self.jwt_verification_keys.get(self.jwt_active_kid)
        if not key:
            raise ValueError(f"JWT_ACTIVE_KID '{self.jwt_active_kid}' is not configured in JWT_KEYS.")
        return key

    @property
    def async_database_url(self) -> str:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is not configured")
        database_url = self.database_url
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        if database_url.startswith("postgresql+psycopg://"):
            parts = urlsplit(database_url)
            query = dict(parse_qsl(parts.query, keep_blank_values=True))
            # Keep standard sslmode if provided, pop any asyncpg specific query params
            query.pop("channel_binding", None)
            return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return database_url

    @property
    def async_connect_args(self) -> dict[str, str]:
        # For psycopg3, sslmode is passed directly. If database is Neon, ensure we require SSL.
        if "neon.tech" in self.database_url:
            return {"sslmode": "require"}
        return {}


@lru_cache
def get_settings() -> Settings:
    return Settings()
