import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_ENTRY_HINT_COOKIE } from '@/lib/session-entry-hint';

export async function redirectPublicVisitorWithSessionHint(): Promise<void> {
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_ENTRY_HINT_COOKIE)?.value === '1') {
    redirect('/home');
  }
}
