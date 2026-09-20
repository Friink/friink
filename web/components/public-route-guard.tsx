"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { loadAuthSession, refreshAuthSession } from '@/lib/auth';

type PublicRouteGuardProps = {
  children: ReactNode;
};

export function PublicRouteGuard({ children }: PublicRouteGuardProps) {
  const router = useRouter();

  useEffect(() => {
    const session = loadAuthSession();

    if (session) {
      router.replace('/home');
      return;
    }

    refreshAuthSession()
      .then(() => {
        router.replace('/home');
      })
      .catch(() => {
        // The public page remains usable when refresh is unavailable or the
        // existing refresh cookie is terminally invalid. Only a successful
        // refresh should redirect a signed-out visitor to the app.
      });
  }, [router]);

  return <>{children}</>;
}
