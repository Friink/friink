import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { authConfig } from '@/lib/config';
import { clearPendingCookies, pendingCookie } from '@/lib/pending-auth';

export const runtime = 'nodejs';

function cookieHeader(headers: Headers) {
  const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : []);
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });

  let result;
  try {
    result = await auth.api.signInEmail({ body: { email, password }, headers: request.headers, returnHeaders: true });
  } catch {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  }
  if (!result.response?.user) return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  const temporaryCookies = cookieHeader(result.headers);
  if (temporaryCookies) await auth.api.signOut({ headers: new Headers({ cookie: temporaryCookies }) });

  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' }, headers: request.headers });
  const expiresAt = Date.now() + authConfig.otpExpiresInSeconds * 1000;
  const response = NextResponse.json({ success: true });
  for (const cookie of clearPendingCookies()) response.headers.append('set-cookie', cookie);
  response.headers.append('set-cookie', pendingCookie({ email, purpose: 'login', otp: 'plugin', expiresAt }));
  return response;
}
