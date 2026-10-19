"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadAuthSession } from '@/lib/auth';
import { getAuthOrigin } from '@/lib/api-origin';

export function LoginClient() {
  const router = useRouter();

  useEffect(() => {
    const session = loadAuthSession();
    if (session) {
      router.replace('/home');
      return;
    }

    // Better Auth is the hosted credential and browser-session owner. Keep
    // the Web App's old login UI unreachable during the cutover; it remains
    // available in source until the new flow is verified end to end.
    const returnTo = `${window.location.origin}/home`;
    window.location.assign(`${getAuthOrigin()}/start?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router]);

  return null;
}
