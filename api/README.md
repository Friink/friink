# Friink API

Clean FastAPI starter for the Friink backend.

## Setup

```powershell
cd api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create a local `.env` file when database access is needed:

```env
DATABASE_URL=
```

On Vercel, add the same `DATABASE_URL` value in the API project's environment variables.

## Run

```powershell
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/` and it should return:

```text
Hello, World!
```

## Reset Staging Database

This drops and recreates the `public` schema for the configured database.

```powershell
$env:DATABASE_URL = "postgresql://..."
python scripts/reset_database.py
```
