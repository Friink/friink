import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { clearPendingCookies, otpMatches, readPendingCookie, verifiedSignupCookie } from '@/lib/pending-auth';

export const runtime = 'nodejs';

function copyCookies(source: Headers, target: NextResponse) {
  const cookies = typeof source.getSetCookie === 'function' ? source.getSetCookie() : (source.get('set-cookie') ? [source.get('set-cookie') as string] : []);
  for (const cookie of cookies) target.headers.append('set-cookie', cookie);
}

export async function POST(request: Request) {
  const pending = readPendingCookie(request);
  const body = await request.json().catch(() => null) as { otp?: unknown; password?: unknown } | null;
  const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';
  if (!pending || !/^\d{6}$/.test(otp)) return NextResponse.json({ error: 'That code is not valid or has expired.' }, { status: 400 });

  if (!otpMatches(pending.otp, otp)) return NextResponse.json({ error: 'That code is not valid or has expired.' }, { status: 400 });

  if (pending.purpose === 'signup') {
    const response = NextResponse.json({ success: true, purpose: 'signup' });
    response.headers.append('set-cookie', verifiedSignupCookie(pending.email, pending.expiresAt));
    response.headers.append('set-cookie', clearPendingCookies()[0]);
    return response;
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) return NextResponse.json({ error: 'Enter your password again.' }, { status: 400 });
  let result;
  try {
    result = await auth.api.signInEmail({ body: { email: pending.email, password }, headers: request.headers, returnHeaders: true });
  } catch {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  }
  if (!result.response?.user) return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
  const response = NextResponse.json({ success: true, user: result.response.user });
  copyCookies(result.headers, response);
  for (const cookie of clearPendingCookies()) response.headers.append('set-cookie', cookie);
  return response;
}
