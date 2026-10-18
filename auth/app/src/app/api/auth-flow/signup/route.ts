import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { database } from '@/lib/database';
import { clearPendingCookies, readVerifiedSignupCookie } from '@/lib/pending-auth';

export const runtime = 'nodejs';

function copyCookies(source: Headers, target: NextResponse) {
  const cookies = typeof source.getSetCookie === 'function' ? source.getSetCookie() : (source.get('set-cookie') ? [source.get('set-cookie') as string] : []);
  for (const cookie of cookies) target.headers.append('set-cookie', cookie);
}

export async function POST(request: Request) {
  const verified = readVerifiedSignupCookie(request);
  const body = await request.json().catch(() => null) as { password?: unknown; name?: unknown; username?: unknown; dateOfBirth?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const dateOfBirth = typeof body?.dateOfBirth === 'string' ? body.dateOfBirth.trim() : '';
  if (!verified || !password || !username || !dateOfBirth) return NextResponse.json({ error: 'Verify your email before creating the account.' }, { status: 400 });

  let result;
  try {
    result = await auth.api.signUpEmail({ body: { email: verified.email, password, name, username }, headers: request.headers, returnHeaders: true });
  } catch {
    return NextResponse.json({ error: 'We could not create that account.' }, { status: 400 });
  }
  await database.query('UPDATE "user" SET "emailVerified" = TRUE WHERE lower("email") = $1', [verified.email]);
  if (result.response?.user) result.response.user.emailVerified = true;
  const response = NextResponse.json({ ...result.response, dateOfBirth }, { status: 200 });
  copyCookies(result.headers, response);
  for (const cookie of clearPendingCookies()) response.headers.append('set-cookie', cookie);
  return response;
}
