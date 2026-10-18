# Friink Auth

This is a vanilla Better Auth dependency install for the future hosted auth
service at `https://auth.friink.com`. It is not connected to Friink's current
FastAPI authentication path.

## Local setup

```powershell
npm install
```

The local `auth/.env` contains the production variable contract with secret
and database values intentionally blank. Fill those values only in a secure
deployment environment; do not commit them.

The next implementation step is to add a Better Auth server configuration and
database adapter before running schema migration commands.
