import { NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { authConfig } from '@/lib/config';
import { database } from '@/lib/database';
import { otpEmail, sendTransactionalEmail } from '@/lib/email/connector';
import { clearPendingCookies, pendingCookie } from '@/lib/pending-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 320) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  const existing = await database.query('SELECT 1 FROM "user" WHERE lower("email") = $1 LIMIT 1', [email]);
  if (existing.rowCount) return NextResponse.json({ error: 'That email is already registered.' }, { status: 400 });

  const otp = String(randomInt(100000, 1000000));
  try {
    await sendTransactionalEmail({ to: email, type: 'otp', subject: 'Your Friink verification code', html: otpEmail(otp, 'email-verification') });
  } catch (error) {
    console.error('Signup OTP delivery failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'We could not send a verification code.' }, { status: 502 });
  }
  const expiresAt = Date.now() + authConfig.otpExpiresInSeconds * 1000;
  const response = NextResponse.json({ success: true });
  for (const cookie of clearPendingCookies()) response.headers.append('set-cookie', cookie);
  response.headers.append('set-cookie', pendingCookie({ email, purpose: 'signup', otp: 'plugin', expiresAt }));
  return response;
}
