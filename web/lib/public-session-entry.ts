import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_ENTRY_HINT_COOKIE } from '@/lib/session-entry-hint';

export async function redirectPublicVisitorWithSessionHint(): Promise<void> {
  const cookieStore = await cookies();
  const hint = cookieStore.get(SESSION_ENTRY_HINT_COOKIE)?.value;
  if (hint && /^\d+$/.test(hint)) {
    const value = Number(hint);
    if (Number.isSafeInteger(value) && value > 0) redirect('/home');
  }
}
