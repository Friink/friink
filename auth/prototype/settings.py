"""Local-only django-allauth and OIDC provider prototype settings."""

import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from dotenv import load_dotenv

AUTH_ROOT = Path(__file__).resolve().parents[1]
AUTH_ENVIRONMENT = os.environ.get("AUTH_ENVIRONMENT", "local").lower()
if AUTH_ENVIRONMENT not in {"local", "development", "staging"}:
    raise RuntimeError("AUTH_ENVIRONMENT must be local, development, or staging")
if AUTH_ENVIRONMENT != "local":
    load_dotenv(AUTH_ROOT / f".env.{AUTH_ENVIRONMENT}", override=True)

SECRET_KEY = "local-auth-prototype-only-do-not-deploy"
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
ROOT_URLCONF = "prototype.urls"
WSGI_APPLICATION = "prototype.wsgi.application"
ASGI_APPLICATION = "prototype.asgi.application"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.messages",
    "django.contrib.sessions",
    "django.contrib.sites",
    "django.contrib.staticfiles",
    "accounts",
    "allauth",
    "allauth.account",
    "allauth.headless",
    "allauth.idp.oidc",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    if not DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg://")):
        raise RuntimeError("The auth DATABASE_URL must use PostgreSQL")
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1)
    parsed_database_url = urlsplit(DATABASE_URL)
    database_options = {key: values[-1] for key, values in parse_qs(parsed_database_url.query).items()}
    database_options.setdefault("sslmode", "require")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": unquote(parsed_database_url.path.lstrip("/")),
            "USER": unquote(parsed_database_url.username or ""),
            "PASSWORD": unquote(parsed_database_url.password or ""),
            "HOST": parsed_database_url.hostname or "",
            "PORT": parsed_database_url.port or "",
            "OPTIONS": database_options,
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": "auth-prototype.sqlite3"}}

SITE_ID = 1
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_LOGIN_METHODS = {"email", "username"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "username"]
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_LOGIN_BY_CODE_ENABLED = True
ACCOUNT_LOGIN_BY_CODE_TIMEOUT = 180
ACCOUNT_LOGIN_BY_CODE_SUPPORTS_RESEND = True

HEADLESS_SERVE_SPECIFICATION = True
HEADLESS_TOKEN_STRATEGY = (
    "allauth.headless.tokens.strategies.sessions.SessionTokenStrategy"
)

# Generate a local RSA key for OIDC signing; never use this setting in deployment.
IDP_OIDC_PRIVATE_KEY = os.environ.get("AUTH_OIDC_PRIVATE_KEY", "")

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "Friink Local Auth <auth@localhost>"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "accounts.hashers.FriinkBcryptPasswordHasher",
]
