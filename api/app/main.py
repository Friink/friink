import hashlib
import logging
import time
from uuid import uuid4

import psycopg
from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.connections import router as connections_router
from app.routers.chat import router as chat_router
from app.routers.notifications import router as notifications_router
from app.routers.posts import router as posts_router
from app.routers.users import router as users_router
from app.routers.account_lifecycle import router as account_lifecycle_router
from app.routers.auth_diagnostics import router as auth_diagnostics_router
from app.routers.auth_operations import router as auth_operations_router
from app.routers.staff import router as staff_router
from app.routers.subscriptions import router as subscriptions_router
from app.routers.progressive_auth import router as progressive_auth_router
from app.routers.professional_registration import router as professional_registration_router
from app.routers.search import router as search_router
from app.services.auth_debug import log_refresh_request_result
from app.services.auth_refresh_diagnostics import record_refresh_attempt

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
    expose_headers=["X-Friink-Request-Id"],
)
app.include_router(auth_router)
app.include_router(connections_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(posts_router)
app.include_router(users_router)
app.include_router(account_lifecycle_router)
app.include_router(auth_diagnostics_router)
app.include_router(auth_operations_router)
app.include_router(staff_router)
app.include_router(subscriptions_router)
app.include_router(progressive_auth_router)
app.include_router(professional_registration_router)
app.include_router(search_router)


@app.exception_handler(HTTPException)
async def capture_safe_failure_class(request: Request, exc: HTTPException):
    detail = exc.detail
    code = detail.get("code") if isinstance(detail, dict) else None
    if (
        isinstance(code, str)
        and 1 <= len(code) <= 64
        and code.isascii()
        and code.replace("_", "").isalnum()
    ):
        request.state.failure_code = code
    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def attach_request_id_to_unhandled_error(request: Request, _exc: Exception):
    response = PlainTextResponse("Internal Server Error", status_code=500)
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers["X-Friink-Request-Id"] = request_id
    return response


@app.middleware("http")
async def add_request_correlation(request: Request, call_next):
    request_id = uuid4().hex
    request.state.request_id = request_id
    if request.url.path == "/auth/refresh":
        request.state.refresh_started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        if request.url.path == "/auth/refresh":
            await run_in_threadpool(record_refresh_attempt, request=request, status_code=500, exception_type=type(exc).__name__)
            log_refresh_request_result(
                request=request,
                status_code=500,
                exception_type=type(exc).__name__,
            )
        raise

    response.headers["X-Friink-Request-Id"] = request_id
    if request.url.path == "/auth/refresh":
        await run_in_threadpool(record_refresh_attempt, request=request, status_code=response.status_code)
        log_refresh_request_result(request=request, status_code=response.status_code)
    return response


@app.get("/")
def read_root() -> dict[str, str]:
    """Return a minimal public service identity response."""
    return {"service": "friink-api", "status": "ok"}


@app.get("/health")
def read_health() -> dict[str, str]:
    """Return a dependency-free liveness response for platform probes."""
    return {"status": "ok"}


@app.get("/health/db")
def read_database_health() -> dict[str, bool]:
    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    return {"database": True}
