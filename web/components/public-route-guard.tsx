"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isTerminalRefreshFailure, loadAuthSession, refreshAuthSession } from '@/lib/auth';

type PublicRouteGuardProps = {
  children: ReactNode;
};

export function PublicRouteGuard({ children }: PublicRouteGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const session = loadAuthSession();

    if (session) {
      router.replace('/home');
      return () => { cancelled = true; };
    }

    refreshAuthSession()
      .then(() => {
        if (!cancelled) router.replace('/home');
      })
      .catch((error) => {
        if (!cancelled && isTerminalRefreshFailure(error)) setChecked(true);
      });

    return () => { cancelled = true; };
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}
