"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, getCurrentUser, loadAuthSession, saveAuthSession, type AuthUser } from '@/lib/auth';
import type { Screen } from '@/lib/data';

type AppShellRouteProps = {
  initialScreen?: Screen;
  refreshCurrentUser?: boolean;
  connectionsUsername?: string;
  initialConnectionsFilter?: 'all' | 'followers' | 'following' | 'requests';
};

export function AppShellRoute({ initialScreen, refreshCurrentUser = false, connectionsUsername, initialConnectionsFilter = 'all' }: AppShellRouteProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => loadAuthSession()?.user ?? null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setUser(null);
      router.replace('/login');
      return;
    }

    setUser(session.user);

    if (!refreshCurrentUser) {
      return;
    }

    getCurrentUser(session.accessToken)
      .then((currentUser) => {
        saveAuthSession({ ...session, user: currentUser });
        setUser(currentUser);
      })
      .catch(() => {
        clearAuthSession();
        router.replace('/login');
      });
  }, [refreshCurrentUser, router]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  return <AppShell user={user} onLogout={handleLogout} initialScreen={initialScreen} onUserChange={refreshCurrentUser ? setUser : undefined} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} />;
}
