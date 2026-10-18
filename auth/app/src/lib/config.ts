function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export const authConfig = {
  emailDomain: required('AUTH_EMAIL_DOMAIN'),
  emailApiKey: required('EMAIL_API_KEY'),
  maxSessions: positiveInteger('AUTH_MAX_SESSIONS', 4),
  sessionExpiresInSeconds: positiveInteger('AUTH_SESSION_EXPIRES_IN_DAYS', 7) * 24 * 60 * 60,
  sessionUpdateAgeSeconds: positiveInteger('AUTH_SESSION_UPDATE_AGE_DAYS', 1) * 24 * 60 * 60,
  otpEnabled: process.env.AUTH_OTP_ENABLED !== 'false',
  otpExpiresInSeconds: positiveInteger('AUTH_OTP_EXPIRES_IN_MINUTES', 10) * 60,
  otpMaxAttempts: positiveInteger('AUTH_OTP_MAX_ATTEMPTS', 5),
  otpResentLimit: positiveInteger('AUTH_OTP_RESENT_LIMIT', 3),
  otpResentInSeconds: positiveInteger('AUTH_OTP_RESENT_IN_SECONDS', 60),
};
