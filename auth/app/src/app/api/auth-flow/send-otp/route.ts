import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { database } from '@/lib/database';
import { issuePendingOtp } from '@/lib/otp-flow';
import { clearPendingCookies, pendingCookie } from '@/lib/pending-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; purpose?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const purpose = body?.purpose === 'signup' || body?.purpose === 'login' || body?.purpose === 'password-reset' ? body.purpose : null;
  if (!purpose) return NextResponse.json({ error: 'Choose a valid authentication flow.' }, { status: 400 });
  if (!email || !email.includes('@') || email.length > 320) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  const existing = await database.query('SELECT 1 FROM "user" WHERE lower("email") = $1 LIMIT 1', [email]);
  if (purpose === 'password-reset') {
    try {
      await auth.api.requestPasswordResetEmailOTP({ body: { email }, headers: request.headers });
    } catch (error) {
      console.error('Password reset OTP delivery failed', error instanceof Error ? error.message : error);
    }
    return NextResponse.json({ success: true });
  }
  if (purpose === 'signup' && existing.rowCount) return NextResponse.json({ error: 'Unable to start signup with this email.' }, { status: 400 });
  if (purpose === 'login' && !existing.rowCount) return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });

  try {
    const { otp, expiresAt } = await issuePendingOtp(email, purpose);
    const response = NextResponse.json({ success: true });
    for (const cookie of clearPendingCookies()) response.headers.append('set-cookie', cookie);
    response.headers.append('set-cookie', pendingCookie({ email, purpose, otp, expiresAt }));
    return response;
  } catch (error) {
    console.error('Authentication OTP delivery failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'We could not send a verification code.' }, { status: 502 });
  }
}
