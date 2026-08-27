# Friink API

Clean FastAPI starter for the Friink backend.

## Setup

```powershell
cd api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run

```powershell
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/` and it should return:

```text
Hello, World!
```
