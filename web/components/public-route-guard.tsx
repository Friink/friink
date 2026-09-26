"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthSession, hasSessionForEntry, isTerminalRefreshFailure, loadAuthSession, loadCachedAuthUser, restoreAuthSessionForEntry } from '@/lib/auth';

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
      const cachedUser = loadCachedAuthUser();
      try {
        if (!await hasSessionForEntry()) return;
        await restoreAuthSessionForEntry();
        if (!active) return;
        router.replace('/home');
      } catch (error) {
        if (!active) return;
        if (isTerminalRefreshFailure(error)) {
          clearAuthSession();
          return;
        }
        if (cachedUser) {
          // A previously authenticated visitor stays in the app's retryable
          // recovery state during a network outage. Signed-out visitors have
          // no cached active identity and keep seeing public content.
          router.replace('/home');
        }
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
