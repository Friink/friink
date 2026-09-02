import hashlib
import logging

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.connections import router as connections_router
from app.routers.chat import router as chat_router
from app.routers.notifications import router as notifications_router
from app.routers.posts import router as posts_router

settings = get_settings()
logger = logging.getLogger("friink.auth")
logger.info("JWT secret fingerprint: %s", hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).hexdigest()[:8])

app = FastAPI(
    title="Friink API",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)
# Allowed CORS origins.
# - FRONTEND_URL env var: set to the deployed web origin per environment
#   (e.g. https://staging.friink.com for staging, https://friink.com for prod).
# - The two localhost values cover local development on the default web port.
_cors_origins: list[str] = [
    str(settings.frontend_url),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Always permit staging explicitly so CORS is not the blocker when
# FRONTEND_URL has not yet been set in the Vercel API project env vars.
if "https://staging.friink.com" not in _cors_origins:
    _cors_origins.append("https://staging.friink.com")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(connections_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(posts_router)


@app.get("/", response_class=PlainTextResponse)
def read_root() -> str:
    return "Hello, World!"


@app.get("/health/db")
def read_database_health() -> dict[str, bool]:
    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    return {"database": True}
