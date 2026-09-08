"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';
import { AuthApiError, clearAuthSession, getCurrentUser, isTerminalRefreshFailure, loadAuthSession, logout, refreshAuthSession, saveAuthSession, type AuthUser } from '@/lib/auth';
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
  const [user, setUser] = useState<AuthUser | null>(() => loadAuthSession()?.user ?? null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(() => Boolean(loadAuthSession()));
  const [sessionError, setSessionError] = useState<'offline' | 'expired' | null>(null);

  useEffect(() => {
    const handleAccountSwitch = () => window.location.reload();
    window.addEventListener('friink-account-switched', handleAccountSwitch);
    return () => window.removeEventListener('friink-account-switched', handleAccountSwitch);
  }, []);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      refreshAuthSession()
        .then((restoredSession) => {
          saveAuthSession(restoredSession);
          setUser(restoredSession.user);
          setSessionError(null);
          setAuthCheckComplete(true);
        })
        .catch((error) => {
          setAuthCheckComplete(true);
          if (isTerminalRefreshFailure(error)) {
            setSessionError('expired');
            setUser(null);
            router.replace('/login');
          } else {
            setSessionError('offline');
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
        if (error instanceof AuthApiError && error.status === 401 && !loadAuthSession()) {
          router.replace('/login');
        }
      });
  }, [refreshCurrentUser, router]);

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
      clearAuthSession();
      router.replace('/');
    } catch {
      // Preserve the active account on ambiguous network/API failures. The
      // user can retry logout without losing the usable local session.
      setLogoutError('Could not log out. Your account is still active; please try again.');
    }
  }

  if (!user) {
    if (!authCheckComplete) return null;
    return (
    <main className="lifecycle-screen">
        <a className="lifecycle-home-link" href="/" aria-label="Return to Friink home"><FriinkLogo /></a>
        <section className="lifecycle-card" aria-labelledby="session-recovery-title">
          <BrandLockup size="lg" />
          <h1 id="session-recovery-title">We couldn’t restore this session.</h1>
          <p>{sessionError === 'offline' ? 'Friink is having trouble reconnecting. Your account has not been signed out.' : 'Your session has expired or is no longer available. Sign in again to continue.'}</p>
          <div className="lifecycle-actions">
            {sessionError === 'offline' ? <button className="lifecycle-primary-button" type="button" onClick={() => window.location.reload()}>Try again</button> : null}
            <button className="lifecycle-secondary-button" type="button" onClick={() => router.replace('/login')}>Go to login</button>
          </div>
        </section>
      </main>
    );
  }

  return <AppShell user={user} onLogout={handleLogout} logoutError={logoutError} initialScreen={initialScreen} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} initialSavedSection={initialSavedSection} />;
}
