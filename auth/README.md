# Local django-allauth prototype

This is an isolated Django auth service using django-allauth account flows and
its built-in OpenID Connect (OIDC) provider. Local mode uses SQLite and prints
email to the terminal. Development and staging modes read their matching
`DATABASE_URL` from `.env.development` and `.env.staging` respectively.
Staging has not been initialized or imported by this prototype.

## Development accounts and data boundary

The development auth database has Django/allauth's own user, email-verification,
session, and OIDC-provider tables. It also has `friink_account_links`, a private
cross-reference from a Django user to the UUID of the existing Friink user and
a separately generated opaque subject reserved for later OIDC integration.
The development import copied three users, their email and username, bcrypt
password hashes, staff flag, active/locked state, email verification status,
and the private cross-reference. Password hashes are verified by the local
`FriinkBcryptPasswordHasher`; a successful login upgrades them to Django's
preferred PBKDF2 format. It does not copy profiles, posts, relationships, or
Friink session/refresh-token rows. Those remain in userdata.

This is not a live login integration. Friink's API does not yet resolve the
auth service's OIDC subject to the userdata UUID, and the OIDC provider has not
yet been configured to use the reserved subject mapping. Do not route Friink
login to this service until that bridge is implemented and verified.

To migrate development accounts (safe to rerun; already-linked accounts are
skipped), first install `auth/requirements.txt`, then run from the repository
root:

```powershell
$env:AUTH_ENVIRONMENT = 'development'
& auth/.venv/Scripts/python.exe auth/manage.py migrate --noinput
& auth/.venv/Scripts/python.exe auth/manage.py import_development_users
```

The importer reads only `api/.env.development` and writes only to
`auth/.env.development`. It aborts the import transaction on unsupported
password hashes or account conflicts. It never prints account data or
connection strings.

## Run it on localhost

Requirements: Python and OpenSSL. From the repository root in PowerShell:

```powershell
py -m venv --without-pip auth/.venv
$env:PIP_NO_INDEX = '0'
$venvPython = (Resolve-Path auth/.venv/Scripts/python.exe).Path
py -m pip --python $venvPython install -r auth/requirements.txt
@'
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
Path('auth/local-oidc-private.pem').write_bytes(key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
))
'@ | & $venvPython -
$env:AUTH_ENVIRONMENT = 'local'
$env:AUTH_OIDC_PRIVATE_KEY = Get-Content auth/local-oidc-private.pem -Raw
& $venvPython auth/manage.py migrate
& $venvPython auth/manage.py createsuperuser
& $venvPython auth/manage.py runserver 127.0.0.1:8001
```

Open <http://127.0.0.1:8001/admin/> to create an OIDC client and set its
redirect URI to the callback of whichever test client you use. The allauth OIDC
discovery document is at
<http://127.0.0.1:8001/.well-known/openid-configuration>; JWKS is at
<http://127.0.0.1:8001/.well-known/jwks.json>. The admin interface also
provides the generated client secret at creation time. The account sign-in
page is under `/accounts/login/`; email verification and login-code messages
are printed in the server terminal.

Allauth's OIDC provider includes the standard authorization-code flow. The
provider defaults to opaque access tokens; the identity token and userinfo
endpoint are the normal OIDC way for a client to obtain the signed-in identity.
The provider's documented defaults include one-hour access tokens,
five-minute ID tokens, and refresh tokens that do not expire. These defaults
are only for local exploration and must be reviewed before any deployment.

## What the experiment can establish

- Whether allauth's built-in login, email verification, and email-code flows
  fit Friink's desired sign-in UX.
- Whether a local OIDC client can sign in through this service and return to its
  registered localhost callback.
- What identity and claims a client receives, and how the imported private
  account mapping must be exposed to the API.

The Friink login button is not connected to this service. Connecting it later
requires registering Friink as an OIDC client, adding the callback and code
exchange to the web/API boundary, and mapping the allauth identity to the
existing Friink account. The local signing key and fixed development secret
must never be used outside this machine.

For production, the OIDC issuer URL would be `https://auth.friink.com`. A
browser sent through that OIDC sign-in flow would show `auth.friink.com` during
login, then return to the registered Friink callback. On this local prototype
the visible host is `127.0.0.1:8001`.
