"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutActiveAccountWithFallback, type ActiveAccountLogoutOptions, type AuthUser } from '@/lib/auth';

/** Shared server-backed logout and remembered-account fallback for app surfaces. */
export function useAppAccountLogout(onUserChange?: (user: AuthUser | null) => void) {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutInFlight = useRef(false);

  async function handleLogout(options?: ActiveAccountLogoutOptions) {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLogoutError(null);
    try {
      const result = await logoutActiveAccountWithFallback(options);
      if (result.kind === 'selection-changed') return;
      if (result.kind === 'restored') {
        onUserChange?.(result.session.user);
        router.replace('/home/explore');
      } else if (result.kind === 'recovery') {
        onUserChange?.(null);
        router.replace('/home/explore');
      } else {
        onUserChange?.(null);
        router.replace('/');
      }
    } catch {
      // A failed or lost response is ambiguous: keep the local account context
      // and let the user retry instead of silently clearing their session.
      setLogoutError('Could not confirm logout. Please try again.');
    } finally {
      logoutInFlight.current = false;
    }
  }

  return { handleLogout, logoutError };
}
