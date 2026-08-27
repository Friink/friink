from fastapi import FastAPI
from fastapi.responses import PlainTextResponse

app = FastAPI(title="Friink API")


@app.get("/", response_class=PlainTextResponse)
def read_root() -> str:
    return "Hello, World!"
