import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

const PENDING_COOKIE = 'friink_auth_pending';
const VERIFIED_COOKIE = 'friink_signup_verified';

type PendingPayload = { email: string; purpose: 'login' | 'signup'; expiresAt: number; otp: string };

function key() { return createHash('sha256').update(env.secret).digest(); }

function seal(payload: PendingPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function open(value: string): PendingPayload | null {
  try {
    const bytes = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as PendingPayload;
    return payload.email && payload.purpose && payload.otp && payload.expiresAt >= Date.now() ? payload : null;
  } catch { return null; }
}

export function pendingCookie(payload: PendingPayload) {
  const maxAge = Math.max(1, Math.floor((payload.expiresAt - Date.now()) / 1000));
  return `${PENDING_COOKIE}=${seal(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function verifiedSignupCookie(email: string, expiresAt: number) {
  return `${VERIFIED_COOKIE}=${seal({ email, purpose: 'signup', otp: 'verified', expiresAt })}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))}`;
}

function read(request: Request, name: string) {
  const value = request.headers.get('cookie')?.match(new RegExp(`${name}=([^;]+)`))?.[1];
  return value ? open(value) : null;
}

export function readPendingCookie(request: Request) { return read(request, PENDING_COOKIE); }
export function readVerifiedSignupCookie(request: Request) { return read(request, VERIFIED_COOKIE)?.purpose === 'signup' ? read(request, VERIFIED_COOKIE) : null; }

export function clearPendingCookies() {
  return [
    `${PENDING_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${VERIFIED_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export function otpMatches(expected: string, provided: string) {
  const left = createHash('sha256').update(expected).digest();
  const right = createHash('sha256').update(provided).digest();
  return timingSafeEqual(left, right);
}
