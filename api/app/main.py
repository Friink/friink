import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.posts import router as posts_router

settings = get_settings()

app = FastAPI(title="Friink API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.frontend_url), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
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
