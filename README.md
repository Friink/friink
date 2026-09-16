# Friink

Friink is a social microblogging and professional-discovery platform for the
Pakistani mental-wellness community.

This repository contains the web client, FastAPI service, database migrations,
tests, and shared project documentation.

## Repository layout

```text
web/       Next.js web client
api/       FastAPI service, models, migrations, scripts, and tests
docs/      Product, architecture, stack, design, and testing documentation
packages/  Shared packages and design contracts
```

## Technology

- Web: Next.js, React, TypeScript, and Font Awesome
- API: FastAPI, Uvicorn, SQLAlchemy, and Pydantic
- Database: PostgreSQL with Alembic migrations
- Object storage: Cloudflare R2
- Hosting: separate Vercel projects for `web/` and `api/`

See [the technology stack](docs/stack.md) and [the architecture guide](docs/architecture.md)
for current implementation details.

## Prerequisites

- Node.js and npm
- Python 3.11 or newer
- PostgreSQL, or a configured remote PostgreSQL database for API work

## Quick start

Install the web dependencies:

```powershell
npm install --prefix web
```

Create and prepare the API environment:

```powershell
cd api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Copy `api/.env.example` to a local environment file and set the values needed
for the work you are doing. Never commit secrets or production credentials.

Start the web client from the repository root:

```powershell
npm run dev
```

Start the API in a second terminal:

```powershell
cd api
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

The web client runs on `http://localhost:3000` and the API runs on
`http://127.0.0.1:8000`. The API root returns a service identity response;
`GET /health` is the dependency-free liveness check and `GET /health/db` checks
database readiness.

## Common commands

From the repository root:

```powershell
npm run dev       # Start the web client
npm run build     # Build the web client
npm --prefix web run lint
```

From `api/` with the virtual environment active:

```powershell
python -m pytest                         # Run API tests
python scripts/migrate_before_deploy.py  # Apply and verify migrations
```

Use a separate development database for local work. Do not run database reset
scripts against staging or production unless that operation is explicitly
intended and approved.

## Deployment

Friink deploys as two independent Vercel projects:

- `web/` deploys the Next.js client and uses `NEXT_PUBLIC_API_BASE_URL` for the
  API origin.
- `api/` deploys the FastAPI service through `api/api/index.py` and requires the
  server-side variables documented in `api/.env.example`.

The API deployment runs the migration gate defined in `api/vercel.json`.
Deployment environments, migration gates, and release flow are documented in
the [deployment guide](docs/deployment.md). The [architecture guide](docs/architecture.md)
and [technology stack](docs/stack.md) describe the related runtime boundaries.

## Documentation

- [Architecture](docs/architecture.md) — repository boundaries and runtime shape
- [Technology stack](docs/stack.md) — tools, services, environments, and commands
- [Testing](docs/testing.md) — verification and release criteria
- [Deployment](docs/deployment.md) — environments, migration gates, and release flow
- [Rules](docs/rules.md) — active, implementation-backed product rules
- [Design system](docs/design-system.md) — product-level visual contracts
- [Unit documentation](docs/units/) — feature ownership, behavior, and acceptance criteria
- [API guide](api/README.md) — API setup, endpoints, migrations, and environment details

## Development conventions

- Use `development` for local implementation, `staging` for deployed acceptance
  testing, and `main` for production release.
- Read the relevant documentation before changing product behavior,
  architecture, or visual contracts.
- Keep shared web styling in `web/app/globals.css` and its design-token source,
  `web/theme.config.ts`.
- Prefer targeted verification. New or changed API endpoints require a real
  request/response check.

Additional repository instructions are in [`AGENTS.md`](AGENTS.md).
