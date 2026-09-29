"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SessionRecoveryScreen } from '@/components/session-recovery-screen';
import { useAppAccountLogout } from '@/components/use-app-account-logout';
import type { AppearanceMode } from '@/components/account-screens';
import { acknowledgeSessionTermination, AuthApiError, claimSessionTermination, clearAuthSession, clearAuthSessionForRecovery, clearSessionTermination, getCurrentUser, getRememberedAccountSummaries, getSessionTerminationNotice, isSessionTerminationOwner, isTerminalRefreshFailure, loadAuthSession, loadCachedAuthUser, renewSessionTerminationLease, restoreAccountSession, restoreAuthSessionForEntry, restoreRememberedAccountWithFallback, saveAuthSession, type AccountSummary, type AuthUser, type SessionTerminationCause } from '@/lib/auth';
import { isNetworkRestoreFailure, restoreWithSessionRetries } from '@/lib/session-recovery';
import { clearSessionEntryHint } from '@/lib/session-entry-hint';
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
  const [authCheckComplete, setAuthCheckComplete] = useState(() => Boolean(loadAuthSession()));
  const [sessionError, setSessionError] = useState<'network' | 'offline' | 'expired' | 'security' | null>(null);
  const [termination, setTermination] = useState<{ id: string; cause: SessionTerminationCause; owner: boolean } | null>(null);
  const [recoveryUsername, setRecoveryUsername] = useState<string | null>(null);
  const [recoveryAccounts, setRecoveryAccounts] = useState<AccountSummary[]>([]);
  const [restoringAccountSlot, setRestoringAccountSlot] = useState<string | null>(null);
  const [accountRecoveryError, setAccountRecoveryError] = useState<string | null>(null);
  const [recoveryChoice, setRecoveryChoice] = useState(false);
  const [isContinuingRecovery, setIsContinuingRecovery] = useState(false);
  const [networkRefreshing, setNetworkRefreshing] = useState(false);
  const networkRestoreInFlight = useRef(false);
  const sessionRecoveryInFlight = useRef(false);
  const networkRestoreAccountSlot = useRef<string | null>(null);
  const networkRestoreTerminationId = useRef<string | null>(null);
  const retryNetworkRecoveryRef = useRef<() => void>(() => undefined);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const { handleLogout, logoutError } = useAppAccountLogout((nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      setSessionReady(true);
      setSessionError(null);
      setAuthCheckComplete(true);
      return;
    }
    setSessionReady(false);
    setAuthCheckComplete(false);
  });

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
          if (claimed.acknowledged) {
            if (notice.cause === 'deactivated' || notice.cause === 'pending_deletion') {
              void completeTerminatedSession(termination.id, notice.accountSlot);
            }
          }
        }
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [termination]);

  async function completeTerminatedSession(id: string, failedSlot?: string | null) {
    if (sessionRecoveryInFlight.current) return;
    sessionRecoveryInFlight.current = true;
    setIsContinuingRecovery(true);
    try {
      const fallback = await restoreRememberedAccountWithFallback(failedSlot ? [failedSlot] : []);
      clearSessionTermination(id);
      networkRestoreTerminationId.current = null;
      if (fallback) {
        saveAuthSession(fallback);
        setUser(fallback.user);
        setSessionReady(true);
        setSessionError(null);
        setTermination(null);
        setRecoveryChoice(false);
        setAuthCheckComplete(true);
        router.replace('/home');
      } else {
        clearAuthSession();
        clearSessionEntryHint();
        setTermination(null);
        setRecoveryChoice(false);
        router.replace('/');
      }
    } catch (error) {
      networkRestoreTerminationId.current = id;
      setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
      setRecoveryAccounts(getRememberedAccountSummaries());
      setAuthCheckComplete(true);
    } finally {
      sessionRecoveryInFlight.current = false;
      setIsContinuingRecovery(false);
    }
  }

  retryNetworkRecoveryRef.current = () => {
    if (networkRestoreInFlight.current) return;
    networkRestoreInFlight.current = true;
    setNetworkRefreshing(true);
    void (async () => {
      try {
        if (termination && (networkRestoreTerminationId.current === termination.id || termination.cause === 'deactivated' || termination.cause === 'pending_deletion')) {
          const notice = getSessionTerminationNotice();
          await completeTerminatedSession(termination.id, notice?.accountSlot);
          return;
        }
        const selectedSlot = networkRestoreAccountSlot.current;
        const restoredSession = selectedSlot
          ? await restoreAccountSession(selectedSlot)
          : await restoreAuthSessionForEntry();
        if (termination) clearSessionTermination(termination.id);
        if (selectedSlot) saveAuthSession(restoredSession);
        networkRestoreTerminationId.current = null;
        networkRestoreAccountSlot.current = null;
        setUser(restoredSession.user);
        setSessionReady(true);
        setSessionError(null);
        setTermination(null);
        setRecoveryChoice(false);
        setAuthCheckComplete(true);
        if (selectedSlot) router.replace('/home');
      } catch (error) {
        if (isTerminalRefreshFailure(error)) {
          networkRestoreAccountSlot.current = null;
          clearAuthSessionForRecovery(error);
          const notice = getSessionTerminationNotice();
          setRecoveryUsername(loadCachedAuthUser()?.username ?? null);
          setRecoveryAccounts(getRememberedAccountSummaries());
          setTermination(notice ? { id: notice.id, cause: notice.cause, owner: isSessionTerminationOwner(notice.id) } : null);
          setSessionError(notice ? null : 'expired');
          setUser(null);
          setSessionReady(false);
          setAuthCheckComplete(true);
        } else {
          if (isNetworkRestoreFailure(error)) {
            setRecoveryChoice(false);
            setAccountRecoveryError(null);
          } else {
            networkRestoreAccountSlot.current = null;
          }
          setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
          setAuthCheckComplete(true);
        }
      } finally {
        networkRestoreInFlight.current = false;
        setNetworkRefreshing(false);
      }
    })();
  };

  useEffect(() => {
    if (sessionError !== 'network') return;
    const timer = window.setInterval(() => retryNetworkRecoveryRef.current(), 30_000);
    return () => window.clearInterval(timer);
  }, [sessionError]);

  function cancelSessionRecovery() {
    if (sessionRecoveryInFlight.current || restoringAccountSlot) return;
    if (termination) {
      if (!termination.owner || !isSessionTerminationOwner(termination.id)) return;
      const notice = getSessionTerminationNotice();
      acknowledgeSessionTermination(termination.id);
      void completeTerminatedSession(
        termination.id,
        notice?.accountSlot ?? recoveryAccounts.find((account) => account.username.toLowerCase() === recoveryUsername?.toLowerCase())?.accountSlot,
      );
      return;
    }

    const fallbackAccounts = getRememberedAccountSummaries()
      .filter((account) => account.available && account.accountSlot && account.username.toLowerCase() !== recoveryUsername?.toLowerCase())
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
    if (fallbackAccounts[0]) {
      void handleRestoreRememberedAccount(fallbackAccounts[0]);
      return;
    }

    clearAuthSession();
    clearSessionEntryHint();
    router.replace('/');
  }

  function completeRecoveryAddAccount(user: AuthUser) {
    if (termination) clearSessionTermination(termination.id);
    networkRestoreTerminationId.current = null;
    setUser(user);
    setSessionReady(true);
    setSessionError(null);
    setTermination(null);
    setRecoveryChoice(false);
    setAuthCheckComplete(true);
    setRecoveryUsername(null);
    router.replace('/home');
  }

  useEffect(() => {
    function handleAccountSwitched() {
      const session = loadAuthSession();
      if (!session) return;
      setUser(session.user);
      setSessionReady(true);
      setSessionError(null);
      setAuthCheckComplete(true);
      router.replace('/home');
    }

    window.addEventListener('friink-account-switched', handleAccountSwitched);
    return () => window.removeEventListener('friink-account-switched', handleAccountSwitched);
  }, [router]);

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
      const recoveryQuery = new URLSearchParams(window.location.search).get('session_recovery');
      if (recoveryQuery === 'offline' || recoveryQuery === 'network') {
        window.history.replaceState(window.history.state, '', '/home');
        setRecoveryUsername(cachedUser?.username ?? null);
        setRecoveryAccounts(getRememberedAccountSummaries());
        setSessionError(recoveryQuery === 'network' ? 'network' : 'offline');
        setAuthCheckComplete(true);
        return;
      }
      const notice = getSessionTerminationNotice();
      if (notice && !notice.acknowledged) {
        setRecoveryUsername(cachedUser?.username ?? null);
        setRecoveryAccounts(getRememberedAccountSummaries());
        setTermination({ id: notice.id, cause: notice.cause, owner: isSessionTerminationOwner(notice.id) });
        setAuthCheckComplete(true);
        return;
      }

      const controller = new AbortController();
      restoreWithSessionRetries(() => restoreAuthSessionForEntry(), controller.signal)
        .then((restoredSession) => {
          if (controller.signal.aborted) return;
          setUser(restoredSession.user);
          setSessionReady(true);
          setSessionError(null);
          setAuthCheckComplete(true);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setSessionReady(false);
          setAuthCheckComplete(true);
          if (isTerminalRefreshFailure(error)) {
            clearAuthSessionForRecovery(error);
            const terminationNotice = getSessionTerminationNotice();
            setRecoveryUsername(cachedUser?.username ?? null);
            setRecoveryAccounts(getRememberedAccountSummaries());
            if (terminationNotice) setTermination({ id: terminationNotice.id, cause: terminationNotice.cause, owner: isSessionTerminationOwner(terminationNotice.id) });
            else setSessionError('expired');
          } else {
            setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
            setRecoveryUsername(cachedUser?.username ?? null);
            setRecoveryAccounts(getRememberedAccountSummaries());
            setUser(null);
          }
        });
      return () => controller.abort();
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
          // Session recovery is presented by this route; do not escape to a
          // separate login page solely because a protected request failed.
        }
      });
  }, [refreshCurrentUser, router]);

  async function handleRestoreRememberedAccount(account: AccountSummary) {
    if (restoringAccountSlot || sessionRecoveryInFlight.current) return;
    if (termination && termination.owner && isSessionTerminationOwner(termination.id)) {
      acknowledgeSessionTermination(termination.id);
    }
    setRestoringAccountSlot(account.accountSlot);
    setAccountRecoveryError(null);
    try {
      const restoredSession = await restoreAccountSession(account.accountSlot);
      if (termination) clearSessionTermination(termination.id);
      networkRestoreTerminationId.current = null;
      saveAuthSession(restoredSession);
      setUser(restoredSession.user);
      setSessionReady(true);
      setSessionError(null);
      setAuthCheckComplete(true);
      router.replace('/home');
      setRecoveryUsername(null);
    } catch (error) {
      if (isNetworkRestoreFailure(error)) {
        networkRestoreAccountSlot.current = account.accountSlot;
        setRecoveryChoice(false);
        setSessionError('network');
      } else {
        networkRestoreAccountSlot.current = null;
        setAccountRecoveryError(`Could not restore @${account.username}. Choose another account or sign in.`);
      }
    } finally {
      setRestoringAccountSlot(null);
    }
  }

  if (!user) {
    if (!authCheckComplete) return <SessionRecoveryScreen status="loading" appearance={appearance} />;
    const status = recoveryChoice ? 'choice' : sessionError === 'network' ? 'network' : sessionError === 'offline' ? 'offline' : termination ? (termination.owner ? termination.cause : 'waiting') : sessionError ?? 'offline';
    const candidates = getRememberedAccountSummaries().filter((account) => account.available && account.accountSlot && account.username.toLowerCase() !== recoveryUsername?.toLowerCase());
    return <SessionRecoveryScreen status={status} appearance={appearance} onCancelRecovery={cancelSessionRecovery} onAddAccountAuthenticated={completeRecoveryAddAccount} isContinuingRecovery={isContinuingRecovery} onRefresh={() => retryNetworkRecoveryRef.current()} isRefreshing={networkRefreshing} onTakeMeBack={() => { if (termination?.cause === 'deactivated' || termination?.cause === 'pending_deletion') { void completeTerminatedSession(termination.id, getSessionTerminationNotice()?.accountSlot); } else if (candidates.length > 0) setRecoveryChoice(true); else router.replace('/login?session_recovery=1'); }} onChooseLogin={() => { if (termination) clearSessionTermination(termination.id); clearAuthSession(); router.replace('/login?session_recovery=1'); }} accounts={recoveryAccounts} currentUsername={recoveryUsername} restoringAccountSlot={restoringAccountSlot} accountError={accountRecoveryError} onRestoreAccount={handleRestoreRememberedAccount} />;
  }

  return <AppShell key={`${user.id}-${sessionReady ? 'ready' : 'restoring'}`} user={user} onLogout={handleLogout} logoutError={logoutError} initialScreen={initialScreen} initialSearchQuery={initialSearchQuery} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} initialSavedSection={initialSavedSection} />;
}
