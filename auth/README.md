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

## Auth UI package

`@friink/auth-ui` contains the copied Friink authentication presentation for
the future auth service. It exports `AuthShell`, `LoginForm`, `SignupForm`,
`ForgotPasswordForm`, `PasswordCriteria`, and the shared field primitives.
The forms use callback props, so the auth app can connect them to Better Auth
without making the package depend on a particular router or API handler.

```tsx
import '@friink/auth-ui/styles.css';
import { AuthShell, LoginForm } from '@friink/auth-ui';

export function LoginPage() {
  return (
    <AuthShell>
      <LoginForm onSubmit={({ identifier, password }) => {
        // Call the Better Auth client here.
        void identifier;
        void password;
      }} />
    </AuthShell>
  );
}
```
