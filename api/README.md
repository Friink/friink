# Friink API

FastAPI backend for Friink.

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

Required environment variables:

```env
DATABASE_URL=
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=14
```

## Run

```powershell
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/` and it should return:

```text
Hello, World!
```

## Migrations

```powershell
alembic upgrade head
```

The initial migration creates `users` and `otp_codes`. OTP storage and service stubs exist, but OTP is not active yet.

## Auth Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Login returns the access token in JSON and sets the refresh token as an httpOnly cookie. The Next.js client should call the API with:

```ts
credentials: "include"
```

Use `NEXT_PUBLIC_API_BASE_URL` on the frontend only for the API origin, never for database secrets.

## Reset Staging Database

This drops and recreates the `public` schema for the configured database.

```powershell
$env:DATABASE_URL = "postgresql://..."
python scripts/reset_database.py
```
