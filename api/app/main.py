from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
import psycopg

from app.db import get_database_url

app = FastAPI(title="Friink API")


@app.get("/", response_class=PlainTextResponse)
def read_root() -> str:
    return "Hello, World!"


@app.get("/health/db")
def read_database_health() -> dict[str, bool]:
    with psycopg.connect(get_database_url()) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    return {"database": True}
