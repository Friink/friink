"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SessionRecoveryScreen } from '@/components/session-recovery-screen';
import type { AppearanceMode } from '@/components/account-screens';
import { AuthApiError, clearAuthSession, getCurrentUser, isTerminalRefreshFailure, loadAuthSession, loadCachedAuthUser, logout, refreshAuthSession, saveAuthSession, type AuthUser } from '@/lib/auth';
import type { Screen } from '@/lib/data';

type AppShellRouteProps = {
  initialScreen?: Screen;
  refreshCurrentUser?: boolean;
  connectionsUsername?: string;
  initialConnectionsFilter?: 'all' | 'followers' | 'following' | 'requests';
  initialHomeFilter?: 'all' | 'following';
  initialMessagesTab?: 'all' | 'muted' | 'requests' | 'archived';
  initialSettingsTab?: 'general' | 'profile' | 'account' | 'subscription' | 'privacy';
  initialSavedSection?: 'posts' | 'profiles';
};

export function AppShellRoute({ initialScreen, refreshCurrentUser = false, connectionsUsername, initialConnectionsFilter = 'all', initialHomeFilter = 'all', initialMessagesTab = 'all', initialSettingsTab = 'general', initialSavedSection = 'posts' }: AppShellRouteProps) {
  const router = useRouter();
  // Keep the server and first client render identical. Browser-only cached
  // metadata is hydrated in the effect below after React has mounted.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [sessionError, setSessionError] = useState<'offline' | 'expired' | 'security' | null>(null);
  const [authRetry, setAuthRetry] = useState(0);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');

  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|; )friink_appearance=([^;]+)/);
      if (!match?.[1]) return;
      const value = decodeURIComponent(match[1]);
      if (value === 'light' || value === 'dark' || value === 'system') {
        setAppearance(value);
      }
    } catch {
      // Keep the system preference when the cookie cannot be read.
    }
  }, []);

  useEffect(() => {
    function handleAccountSwitched() {
      const session = loadAuthSession();
      if (!session) return;
      setUser(session.user);
      setSessionReady(true);
      setSessionError(null);
      setAuthCheckComplete(true);
    }

    window.addEventListener('friink-account-switched', handleAccountSwitched);
    return () => window.removeEventListener('friink-account-switched', handleAccountSwitched);
  }, []);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      const cachedUser = loadCachedAuthUser();
      if (cachedUser) setUser(cachedUser);
      refreshAuthSession()
        .then((restoredSession) => {
          saveAuthSession(restoredSession);
          setUser(restoredSession.user);
          setSessionReady(true);
          setSessionError(null);
          setAuthCheckComplete(true);
        })
        .catch((error) => {
          setSessionReady(false);
          setAuthCheckComplete(true);
          if (isTerminalRefreshFailure(error)) {
            const deliberateSecurityRevocation = error instanceof AuthApiError && error.code === 'SESSION_REVOKED_SECURITY';
            setSessionError(deliberateSecurityRevocation ? 'security' : 'expired');
            setUser(null);
            router.replace(deliberateSecurityRevocation ? '/login?reason=security-revocation' : '/login');
          } else {
            setSessionError('offline');
            setUser(null);
          }
        });
      return;
    }

    setUser(session.user);

    if (initialScreen === 'control-panel' && !session.user.isStaff) {
      router.replace('/home');
      return;
    }

    if (!refreshCurrentUser) {
      return;
    }

    getCurrentUser(session.accessToken)
      .then((currentUser) => {
        if (initialScreen === 'control-panel' && !currentUser.isStaff) {
          router.replace('/home');
          return;
        }
        saveAuthSession({ ...session, user: currentUser });
        setUser(currentUser);
      })
      .catch((error) => {
        // requestApi owns refresh and session clearing. An original-request
        // 401 must not be mistaken for a failed refresh, so redirect only
        // after refreshAuthSession has already removed the local session.
        if (error instanceof AuthApiError && error.status === 401) {
          if (error.code === 'SESSION_REVOKED_SECURITY') {
            clearAuthSession();
            router.replace('/login?reason=security-revocation');
          } else if (!loadAuthSession()) {
            router.replace('/login');
          }
        }
      });
  }, [authRetry, refreshCurrentUser, router]);

  async function handleLogout() {
    const session = loadAuthSession();
    if (!session) {
      clearAuthSession();
      router.replace('/');
      return;
    }
    setLogoutError(null);
    try {
      await logout(session.accessToken, session.accountSlot);
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(`friink-setup-dismissed-${session.user.id}`);
      clearAuthSession();
      router.replace('/');
    } catch {
      // Preserve the active account on ambiguous network/API failures. The
      // user can retry logout without losing the usable local session.
      setLogoutError('Could not log out. Your account is still active; please try again.');
    }
  }

  if (!user) {
    if (!authCheckComplete) return <SessionRecoveryScreen status="loading" appearance={appearance} />;
    return <SessionRecoveryScreen status={sessionError ?? 'offline'} appearance={appearance} onRetry={() => { setSessionError(null); setAuthCheckComplete(false); setAuthRetry((attempt) => attempt + 1); }} />;
  }

  return <AppShell key={`${user.id}-${sessionReady ? 'ready' : 'restoring'}`} user={user} onLogout={handleLogout} logoutError={logoutError} initialScreen={initialScreen} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} initialSavedSection={initialSavedSection} />;
}
