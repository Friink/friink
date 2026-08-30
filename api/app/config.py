from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = Field(default="", alias="DATABASE_URL")
    frontend_url: AnyHttpUrl | str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    r2_account_id: str = Field(default="", alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(default="", alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", alias="R2_SECRET_ACCESS_KEY")
    r2_bucket_name: str = Field(default="", alias="R2_BUCKET_NAME")
    r2_public_url: str = Field(default="", alias="R2_PUBLIC_URL")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

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
