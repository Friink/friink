"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthSessionForRecovery, hasSessionForEntry, isTerminalRefreshFailure, loadAuthSession, loadCachedAuthUser, restoreAuthSessionForEntry } from '@/lib/auth';
import { isNetworkRestoreFailure, restoreWithSessionRetries } from '@/lib/session-recovery';

type PublicRouteGuardProps = {
  children: ReactNode;
};

export function PublicRouteGuard({ children }: PublicRouteGuardProps) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function checkSession() {
      if (loadAuthSession()) {
        router.replace('/home');
        return;
      }
      const cachedUser = loadCachedAuthUser();
      try {
        if (!await hasSessionForEntry()) return;
        await restoreWithSessionRetries(() => restoreAuthSessionForEntry(), controller.signal);
        if (!active || controller.signal.aborted) return;
        router.replace('/home');
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        if (isTerminalRefreshFailure(error)) {
          clearAuthSessionForRecovery(error);
          router.replace('/home');
          return;
        }
        if (cachedUser) {
          router.replace(isNetworkRestoreFailure(error) ? '/home?session_recovery=network' : '/home?session_recovery=offline');
        }
      }
    }

    void checkSession();
    return () => {
      active = false;
      controller.abort();
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
