"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { hasSessionForEntry, loadAuthSession } from '@/lib/auth';
import { hasPublicSessionFailure } from '@/lib/session-recovery-state';

type PublicRouteGuardProps = {
  children: ReactNode;
};

export function PublicRouteGuard({ children }: PublicRouteGuardProps) {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (loadAuthSession()) {
        router.replace('/home');
        return;
      }
      if (new URLSearchParams(window.location.search).get('session_recovery') === 'failed' || hasPublicSessionFailure()) return;
      try {
        if (await hasSessionForEntry() && active) router.replace('/home');
      } catch {
        // A failed probe leaves the public page in place. The app shell owns
        // authoritative validation and recovery after a positive probe.
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    function handleSessionUpdate() {
      if (loadAuthSession()) router.replace('/home');
    }

    window.addEventListener('friink-account-switched', handleSessionUpdate);
    return () => window.removeEventListener('friink-account-switched', handleSessionUpdate);
  }, [router]);

  return <>{children}</>;
}
