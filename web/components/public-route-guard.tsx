"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isTerminalRefreshFailure, loadAuthSession, refreshAuthSession, saveAuthSession } from '@/lib/auth';
import { SessionRecoveryScreen } from '@/components/session-recovery-screen';

type PublicRouteGuardProps = {
  children: ReactNode;
};

export function PublicRouteGuard({ children }: PublicRouteGuardProps) {
  const router = useRouter();
  const [checkState, setCheckState] = useState<'loading' | 'offline' | 'signed-out'>('loading');
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      setCheckState('loading');
      const session = loadAuthSession();

      if (session) {
        router.replace('/home');
        return;
      }

      try {
        const restoredSession = await refreshAuthSession();
        if (!active) return;
        saveAuthSession(restoredSession);
        router.replace('/home');
      } catch (error) {
        if (!active) return;
        setCheckState(isTerminalRefreshFailure(error) ? 'signed-out' : 'offline');
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [retryVersion, router]);

  if (checkState === 'loading') {
    return <SessionRecoveryScreen status="loading" />;
  }

  if (checkState === 'offline') {
    return <SessionRecoveryScreen status="offline" onRetry={() => setRetryVersion((current) => current + 1)} />;
  }

  return <>{children}</>;
}
