"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SessionRecoveryScreen } from '@/components/session-recovery-screen';
import type { AppearanceMode } from '@/components/account-screens';
import { acknowledgeSessionTermination, AuthApiError, claimSessionTermination, clearAuthSession, clearAuthSessionForRecovery, clearSessionTermination, getCurrentUser, getLoginRecoveryPath, getRememberedAccountSummaries, getSessionTerminationNotice, isSessionTerminationOwner, isTerminalRefreshFailure, loadAuthSession, loadCachedAuthUser, logout, renewSessionTerminationLease, restoreAccountSession, restoreAuthSessionForEntry, restoreRememberedAccountWithFallback, saveAuthSession, type AccountSummary, type AuthUser, type SessionTerminationCause } from '@/lib/auth';
import type { Screen } from '@/lib/data';

type AppShellRouteProps = {
  initialScreen?: Screen;
  initialSearchQuery?: string;
  refreshCurrentUser?: boolean;
  connectionsUsername?: string;
  initialConnectionsFilter?: 'all' | 'followers' | 'following' | 'requests';
  initialHomeFilter?: 'all' | 'following';
  initialMessagesTab?: 'all' | 'muted' | 'requests' | 'archived';
  initialSettingsTab?: 'general' | 'profile' | 'account' | 'subscription' | 'privacy';
  initialSavedSection?: 'posts' | 'profiles';
};

export function AppShellRoute({ initialScreen, initialSearchQuery, refreshCurrentUser = false, connectionsUsername, initialConnectionsFilter = 'all', initialHomeFilter = 'all', initialMessagesTab = 'all', initialSettingsTab = 'general', initialSavedSection = 'posts' }: AppShellRouteProps) {
  const router = useRouter();
  // Keep the server and first client render identical. Browser-only cached
  // metadata is hydrated in the effect below after React has mounted.
  const [user, setUser] = useState<AuthUser | null>(() => loadAuthSession()?.user ?? null);
  const [sessionReady, setSessionReady] = useState(() => Boolean(loadAuthSession()));
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(() => Boolean(loadAuthSession()));
  const [sessionError, setSessionError] = useState<'offline' | 'expired' | 'security' | null>(null);
  const [termination, setTermination] = useState<{ id: string; cause: SessionTerminationCause; owner: boolean } | null>(null);
  const [recoveryUsername, setRecoveryUsername] = useState<string | null>(null);
  const [recoveryAccounts, setRecoveryAccounts] = useState<AccountSummary[]>([]);
  const [restoringAccountSlot, setRestoringAccountSlot] = useState<string | null>(null);
  const [accountRecoveryError, setAccountRecoveryError] = useState<string | null>(null);
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
    function handleSessionExpired(event: Event) {
      const detail = (event as CustomEvent<{ accountSlot?: string | null; cause?: SessionTerminationCause; terminationId?: string }>);
      const cachedUser = loadCachedAuthUser();
      setRecoveryUsername(cachedUser?.username ?? null);
      setUser(null);
      setSessionReady(false);
      setAuthCheckComplete(false);
      setSessionError(null);
      setRecoveryAccounts([]);
      const notice = getSessionTerminationNotice();
      const id = detail.detail?.terminationId ?? notice?.id;
      if (id) setTermination({ id, cause: detail.detail?.cause ?? notice?.cause ?? 'expired', owner: isSessionTerminationOwner(id) });
      else setSessionError('expired');
      setAuthCheckComplete(true);
    }
    window.addEventListener('friink-session-expired', handleSessionExpired);
    return () => window.removeEventListener('friink-session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!termination) return;
    const timer = window.setInterval(() => {
      renewSessionTerminationLease(termination.id);
      const notice = getSessionTerminationNotice();
      if (!notice || notice.id !== termination.id) return;
      if (notice.ownerTabId !== undefined && notice.leaseUntil <= Date.now()) {
        const claimed = claimSessionTermination(termination.id);
        if (claimed && isSessionTerminationOwner(termination.id)) {
          setTermination((current) => current?.id === termination.id ? { ...current, owner: true } : current);
          if (claimed.acknowledged) void completeTerminatedSession(termination.id, notice.accountSlot);
        }
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [termination]);

  async function completeTerminatedSession(id: string, failedSlot?: string | null) {
    try {
      const fallback = await restoreRememberedAccountWithFallback(failedSlot ? [failedSlot] : []);
      clearSessionTermination(id);
      if (fallback) {
        saveAuthSession(fallback);
        setUser(fallback.user);
        setSessionReady(true);
        setSessionError(null);
        setTermination(null);
        setAuthCheckComplete(true);
      } else {
        clearAuthSession();
        setTermination(null);
        router.replace('/');
      }
    } catch {
      setSessionError('offline');
      setRecoveryAccounts(getRememberedAccountSummaries());
      setAuthCheckComplete(true);
    }
  }

  function acknowledgeTermination() {
    if (!termination || !termination.owner || !isSessionTerminationOwner(termination.id)) return;
    const notice = getSessionTerminationNotice();
    acknowledgeSessionTermination(termination.id);
    void completeTerminatedSession(termination.id, notice?.accountSlot);
  }

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
    async function handleSessionUpdated(event: Event) {
      const detail = (event as CustomEvent<{ accountSlot?: string | null }>).detail;
      try {
        const updated = await restoreAuthSessionForEntry();
        if (detail?.accountSlot && updated.accountSlot !== detail.accountSlot) return;
        setUser(updated.user);
        setSessionReady(true);
        setSessionError(null);
        setAuthCheckComplete(true);
      } catch {
        // The sending tab has not supplied a credential; stay on the current
        // account until this tab can validate its own slot cookie.
      }
    }
    window.addEventListener('friink-session-updated', handleSessionUpdated);
    return () => window.removeEventListener('friink-session-updated', handleSessionUpdated);
  }, []);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      const cachedUser = loadCachedAuthUser();
      restoreAuthSessionForEntry()
        .then((restoredSession) => {
          setUser(restoredSession.user);
          setSessionReady(true);
          setSessionError(null);
          setAuthCheckComplete(true);
        })
        .catch((error) => {
          setSessionReady(false);
          setAuthCheckComplete(true);
          if (isTerminalRefreshFailure(error)) {
            clearAuthSessionForRecovery(error);
            const notice = getSessionTerminationNotice();
            if (notice) setTermination({ id: notice.id, cause: notice.cause, owner: isSessionTerminationOwner(notice.id) });
            else setSessionError('expired');
          } else {
            setSessionError('offline');
            setRecoveryUsername(cachedUser?.username ?? null);
            setRecoveryAccounts(getRememberedAccountSummaries());
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
        // requestApi owns refresh. A terminal refresh clears in-memory auth
        // while preserving safe recovery context; other 401s stay separate.
        if (error instanceof AuthApiError && isTerminalRefreshFailure(error)) {
          const cachedUser = loadCachedAuthUser();
          setRecoveryUsername(cachedUser?.username ?? null);
          setRecoveryAccounts(getRememberedAccountSummaries());
          clearAuthSessionForRecovery(error);
          const notice = getSessionTerminationNotice();
          if (notice) setTermination({ id: notice.id, cause: notice.cause, owner: isSessionTerminationOwner(notice.id) });
          else setSessionError('expired');
          setUser(null);
          setSessionReady(false);
          setAuthCheckComplete(true);
        } else if (error instanceof AuthApiError && error.status === 401) {
          if (error.code === 'SESSION_REVOKED_SECURITY') {
            router.replace(getLoginRecoveryPath('security-revocation'));
          } else if (!loadAuthSession()) {
            router.replace(getLoginRecoveryPath('expired'));
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
      const fallback = await restoreRememberedAccountWithFallback(session.accountSlot ? [session.accountSlot] : []);
      if (fallback) {
        saveAuthSession(fallback);
        setUser(fallback.user);
        setSessionReady(true);
        setSessionError(null);
        setAuthCheckComplete(true);
      } else {
        clearAuthSession();
        router.replace('/');
      }
    } catch {
      if (loadAuthSession()) {
        setLogoutError('Could not log out. Your account is still active; please try again.');
      } else {
        setSessionError('offline');
        setRecoveryAccounts(getRememberedAccountSummaries());
        setAuthCheckComplete(true);
      }
    }
  }

  async function handleRecoveryLogout() {
    const activeAccount = getRememberedAccountSummaries().find((account) => account.active);
    const failedSlot = activeAccount?.accountSlot;
    try {
      await logout('', failedSlot);
      const fallback = await restoreRememberedAccountWithFallback(failedSlot ? [failedSlot] : []);
      if (fallback) {
        saveAuthSession(fallback);
        setUser(fallback.user);
        setSessionReady(true);
        setSessionError(null);
        setAuthCheckComplete(true);
        return;
      }
      clearAuthSession();
      router.replace('/');
    } catch {
      setSessionError('offline');
      setRecoveryAccounts(getRememberedAccountSummaries());
      setAccountRecoveryError('Could not log out while Friink is unreachable. Try again when the connection is restored.');
      setAuthCheckComplete(true);
    }
  }

  async function handleRestoreRememberedAccount(account: AccountSummary) {
    setRestoringAccountSlot(account.accountSlot);
    setAccountRecoveryError(null);
    try {
      const restoredSession = await restoreRememberedAccountWithFallback([], account.accountSlot);
      if (!restoredSession) throw new AuthApiError('No remembered account session is available.', 401, 'SESSION_NOT_FOUND');
      saveAuthSession(restoredSession);
      setUser(restoredSession.user);
      setSessionReady(true);
      setSessionError(null);
      setAuthCheckComplete(true);
      setRecoveryUsername(null);
    } catch {
      setAccountRecoveryError(`Could not restore @${account.username}. Choose another account or sign in.`);
    } finally {
      setRestoringAccountSlot(null);
    }
  }

  if (!user) {
    if (!authCheckComplete) return <SessionRecoveryScreen status="loading" appearance={appearance} />;
    return <SessionRecoveryScreen status={sessionError === 'offline' ? 'offline' : termination ? (termination.owner ? termination.cause : 'waiting') : sessionError ?? 'offline'} appearance={appearance} onAcknowledge={acknowledgeTermination} onRetry={() => { if (termination) { const notice = getSessionTerminationNotice(); void completeTerminatedSession(termination.id, notice?.accountSlot); } else { setSessionError(null); setAuthCheckComplete(false); setAuthRetry((attempt) => attempt + 1); } }} onLogout={handleRecoveryLogout} accounts={recoveryAccounts} currentUsername={recoveryUsername} restoringAccountSlot={restoringAccountSlot} accountError={accountRecoveryError} onRestoreAccount={handleRestoreRememberedAccount} />;
  }

  return <AppShell key={`${user.id}-${sessionReady ? 'ready' : 'restoring'}`} user={user} onLogout={handleLogout} logoutError={logoutError} initialScreen={initialScreen} initialSearchQuery={initialSearchQuery} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} initialSavedSection={initialSavedSection} />;
}
