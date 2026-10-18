function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? '').split(',').map((value) => value.trim()).filter(Boolean);
}

export const env = {
  authUrl: required('BETTER_AUTH_URL'),
  secret: required('BETTER_AUTH_SECRET'),
  databaseUrl: required('DATABASE_URL'),
  trustedOrigins: list('AUTH_TRUSTED_ORIGINS'),
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
};
