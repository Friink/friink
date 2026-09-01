"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { AuthApiError, clearAuthSession, getCurrentUser, loadAuthSession, refreshAuthSession, saveAuthSession, type AuthUser } from '@/lib/auth';
import type { Screen } from '@/lib/data';

type AppShellRouteProps = {
  initialScreen?: Screen;
  refreshCurrentUser?: boolean;
  connectionsUsername?: string;
  initialConnectionsFilter?: 'all' | 'followers' | 'following' | 'requests';
  initialHomeFilter?: 'all' | 'following';
  initialMessagesTab?: 'all' | 'muted' | 'requests';
  initialSettingsTab?: 'general' | 'profile' | 'account' | 'subscription' | 'privacy';
};

export function AppShellRoute({ initialScreen, refreshCurrentUser = false, connectionsUsername, initialConnectionsFilter = 'all', initialHomeFilter = 'all', initialMessagesTab = 'all', initialSettingsTab = 'general' }: AppShellRouteProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => loadAuthSession()?.user ?? null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      refreshAuthSession()
        .then((restoredSession) => {
          saveAuthSession(restoredSession);
          setUser(restoredSession.user);
        })
        .catch((error) => {
          if (error instanceof AuthApiError && error.status === 401) {
            setUser(null);
            router.replace('/login');
          }
        });
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
      .catch((error) => {
        // requestApi owns refresh and session clearing. An original-request
        // 401 must not be mistaken for a failed refresh, so redirect only
        // after refreshAuthSession has already removed the local session.
        if (error instanceof AuthApiError && error.status === 401 && !loadAuthSession()) {
          router.replace('/login');
        }
      });
  }, [refreshCurrentUser, router]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  return <AppShell user={user} onLogout={handleLogout} initialScreen={initialScreen} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} />;
}
