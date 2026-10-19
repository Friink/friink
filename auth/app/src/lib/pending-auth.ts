import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config";

const COOKIE_NAME = "friink_auth_pending";
const VERIFIED_COOKIE_NAME = "friink_signup_verified";

type PendingPayload = { email: string; purpose: "login" | "signup"; expiresAt: number; otp?: string };

function key() {
  return createHash("sha256").update(config.secret).digest();
}

function seal(payload: PendingPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function open(value: string): PendingPayload | null {
  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as PendingPayload;
    if (!payload.email || !payload.purpose || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function pendingCookie(payload: PendingPayload) {
  return `${COOKIE_NAME}=${seal(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.otpExpiresInSeconds}`;
}

export function readPendingCookie(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];
  return value ? open(value) : null;
}

export function verifiedSignupCookie(email: string) {
  return `${VERIFIED_COOKIE_NAME}=${seal({ email, purpose: "signup", expiresAt: Date.now() + config.otpExpiresInSeconds * 1000 })}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.otpExpiresInSeconds}`;
}

export function readVerifiedSignupCookie(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`${VERIFIED_COOKIE_NAME}=([^;]+)`))?.[1];
  const payload = value ? open(value) : null;
  return payload?.purpose === "signup" ? payload : null;
}

export function clearPendingCookies() {
  return [
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${VERIFIED_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export function otpMatches(expected: string, provided: string) {
  const expectedBytes = createHash("sha256").update(expected).digest();
  const providedBytes = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedBytes, providedBytes);
}
