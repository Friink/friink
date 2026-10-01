"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SessionRecoveryScreen } from '@/components/session-recovery-screen';
import { useAppAccountLogout } from '@/components/use-app-account-logout';
import type { AppearanceMode } from '@/components/account-screens';
import { AuthApiError, claimSessionTermination, clearAuthSession, clearAuthSessionForRecovery, clearSessionTermination, getCurrentUser, getRememberedAccountSummaries, getSessionTerminationNotice, isSessionTerminationOwner, isTerminalRefreshFailure, loadAuthSession, loadCachedAuthUser, renewSessionTerminationLease, restoreAccountSession, restoreAuthSessionForEntry, restoreRememberedAccountWithFallback, runSessionTerminationAction, saveAuthSession, type AccountSummary, type AuthUser, type SessionTerminationCause } from '@/lib/auth';
import { isNetworkRestoreFailure, restoreWithSessionRetries } from '@/lib/session-recovery';
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
  const [currentUserReady, setCurrentUserReady] = useState(() => !refreshCurrentUser);
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
  const completeTerminatedSessionRef = useRef<(id: string, failedSlot?: string | null) => Promise<void>>(async () => undefined);
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
    const syncTerminationOwner = () => {
      const notice = getSessionTerminationNotice();
      if (!notice) {
        const currentSession = loadAuthSession();
        if (currentSession) {
          setUser(currentSession.user);
          setSessionReady(true);
          setSessionError(null);
          setAuthCheckComplete(true);
        } else {
          setTermination(null);
          setSessionError('offline');
          setRecoveryAccounts(getRememberedAccountSummaries());
          setAuthCheckComplete(true);
        }
        return;
      }
      if (notice.id !== termination.id) {
        setTermination({ id: notice.id, cause: notice.cause, owner: isSessionTerminationOwner(notice.id) });
        return;
      }
      const owner = isSessionTerminationOwner(termination.id);
      setTermination((current) => current?.id === termination.id && current.owner !== owner
        ? { ...current, cause: notice.cause, owner }
        : current);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'friink-session-termination') syncTerminationOwner();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('friink-session-termination-updated', syncTerminationOwner);
    const timer = window.setInterval(() => {
      const notice = getSessionTerminationNotice();
      if (!notice || notice.id !== termination.id) {
        syncTerminationOwner();
        return;
      }
      syncTerminationOwner();
      if (isSessionTerminationOwner(termination.id)) {
        renewSessionTerminationLease(termination.id);
      } else if (notice.leaseUntil <= Date.now()) {
        void claimSessionTermination(termination.id).then((claimed) => {
          syncTerminationOwner();
          if (claimed && isSessionTerminationOwner(termination.id)) {
            if (claimed.acknowledged) {
              if (notice.cause === 'deactivated' || notice.cause === 'pending_deletion') {
                void completeTerminatedSessionRef.current(termination.id, notice.accountSlot);
              }
            }
          }
        });
      }
    }, 2000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('friink-session-termination-updated', syncTerminationOwner);
    };
  }, [termination]);

  const completeTerminatedSession = useCallback(async (id: string, failedSlot?: string | null) => {
    if (sessionRecoveryInFlight.current) return;
    sessionRecoveryInFlight.current = true;
    setIsContinuingRecovery(true);
    try {
      const action = await runSessionTerminationAction(id, async () => {
        const notice = getSessionTerminationNotice();
        const fallback = await restoreRememberedAccountWithFallback(
          failedSlot ? [failedSlot] : notice?.accountSlot ? [notice.accountSlot] : [],
        );
        if (fallback) saveAuthSession(fallback);
        else {
          clearAuthSession();
        }
        clearSessionTermination(id);
        return fallback;
      });
      if (!action.performed) {
        const currentNotice = getSessionTerminationNotice();
        if (currentNotice) {
          setTermination({ id: currentNotice.id, cause: currentNotice.cause, owner: isSessionTerminationOwner(currentNotice.id) });
        } else {
          const currentSession = loadAuthSession();
          if (currentSession) {
            setUser(currentSession.user);
            setSessionReady(true);
            setSessionError(null);
            setAuthCheckComplete(true);
          } else {
            setTermination(null);
            router.replace('/');
          }
        }
        return;
      }
      const fallback = action.result ?? null;
      networkRestoreTerminationId.current = null;
      if (fallback) {
        setUser(fallback.user);
        setSessionReady(true);
        setSessionError(null);
        setTermination(null);
        setRecoveryChoice(false);
        setAuthCheckComplete(true);
        router.replace('/home');
      } else {
        clearAuthSession();
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
  }, [router]);

  useEffect(() => {
    completeTerminatedSessionRef.current = completeTerminatedSession;
  }, [completeTerminatedSession]);

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
      const notice = getSessionTerminationNotice();
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
    router.replace('/');
  }

  function continueWaitingRecovery() {
    if (!termination || sessionRecoveryInFlight.current || restoringAccountSlot) return;
    const notice = getSessionTerminationNotice();
    void completeTerminatedSession(termination.id, notice?.accountSlot);
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
      if (cachedUser) setUser(cachedUser);
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
        // A termination notice is shared recovery context, not proof that
        // this tab's current slot is still unavailable. Another tab may have
        // restored or refreshed it after the notice was written. Validate the
        // current slot before presenting recovery or selecting a fallback.
      }

      const controller = new AbortController();
      restoreWithSessionRetries(() => restoreAuthSessionForEntry(), controller.signal)
        .then((restoredSession) => {
          if (controller.signal.aborted) return;
          setUser(restoredSession.user);
          setSessionReady(true);
          setCurrentUserReady(true);
          setSessionError(null);
          setAuthCheckComplete(true);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setSessionReady(false);
          setAuthCheckComplete(true);
          if (isTerminalRefreshFailure(error)) {
            clearAuthSessionForRecovery(error);
            setUser(null);
            setCurrentUserReady(false);
            const terminationNotice = getSessionTerminationNotice();
            setRecoveryUsername(cachedUser?.username ?? null);
            setRecoveryAccounts(getRememberedAccountSummaries());
            if (terminationNotice) setTermination({ id: terminationNotice.id, cause: terminationNotice.cause, owner: isSessionTerminationOwner(terminationNotice.id) });
            else setSessionError('expired');
          } else {
            setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
            setRecoveryUsername(cachedUser?.username ?? null);
            setRecoveryAccounts(getRememberedAccountSummaries());
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
        setCurrentUserReady(true);
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
          setSessionError('offline');
        } else {
          setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
        }
      });
  }, [refreshCurrentUser, router]);

  async function handleRestoreRememberedAccount(account: AccountSummary) {
    if (restoringAccountSlot || sessionRecoveryInFlight.current) return;
    setRestoringAccountSlot(account.accountSlot);
    setAccountRecoveryError(null);
    try {
      const restore = async () => {
        const restoredSession = await restoreAccountSession(account.accountSlot);
        saveAuthSession(restoredSession);
        if (termination) clearSessionTermination(termination.id);
        return restoredSession;
      };
      const action = termination
        ? await runSessionTerminationAction(termination.id, restore)
        : { performed: true, result: await restore() };
      if (!action.performed || !action.result) {
        const currentNotice = getSessionTerminationNotice();
        if (currentNotice) {
          setTermination({ id: currentNotice.id, cause: currentNotice.cause, owner: isSessionTerminationOwner(currentNotice.id) });
        } else {
          const currentSession = loadAuthSession();
          if (currentSession) {
            setUser(currentSession.user);
            setSessionReady(true);
            setSessionError(null);
            setAuthCheckComplete(true);
          } else {
            setTermination(null);
            router.replace('/');
          }
        }
        return;
      }
      const restoredSession = action.result;
      networkRestoreTerminationId.current = null;
        setUser(restoredSession.user);
        setSessionReady(true);
        setCurrentUserReady(true);
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

  async function retryCurrentUser() {
    if (networkRestoreInFlight.current) return;
    networkRestoreInFlight.current = true;
    setNetworkRefreshing(true);
    try {
      const session = loadAuthSession();
      const currentUser = session
        ? await getCurrentUser(session.accessToken)
        : (await restoreAuthSessionForEntry()).user;
      if (initialScreen === 'control-panel' && !currentUser.isStaff) {
        router.replace('/home');
        return;
      }
      const latestSession = loadAuthSession();
      if (latestSession) saveAuthSession({ ...latestSession, user: currentUser });
      setUser(currentUser);
      setSessionReady(true);
      setCurrentUserReady(true);
      setSessionError(null);
    } catch (error) {
      if (isTerminalRefreshFailure(error)) {
        clearAuthSessionForRecovery(error);
        setUser(null);
        setSessionReady(false);
        setCurrentUserReady(false);
      } else {
        setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
      }
    } finally {
      networkRestoreInFlight.current = false;
      setNetworkRefreshing(false);
    }
  }

  if (user && (!sessionReady || !currentUserReady)) {
    const entryMessage = sessionError === 'network'
      ? 'We can’t confirm your session because Friink cannot connect.'
      : sessionError === 'offline'
        ? 'We couldn’t confirm your session. Your private content is still hidden.'
        : null;
    return <AppShell key={`${user.id}-restoring`} user={user} onLogout={handleLogout} logoutError={logoutError} initialScreen={initialScreen} initialSearchQuery={initialSearchQuery} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} initialSavedSection={initialSavedSection} entryPending entryMessage={entryMessage} entryRetrying={networkRefreshing} onRetryEntry={() => refreshCurrentUser ? void retryCurrentUser() : retryNetworkRecoveryRef.current()} onTakeMeBackEntry={sessionError === 'offline' ? cancelSessionRecovery : undefined} />;
  }

  if (!user) {
    if (!authCheckComplete) return <SessionRecoveryScreen status="loading" appearance={appearance} />;
    const status = recoveryChoice ? 'choice' : sessionError === 'network' ? 'network' : sessionError === 'offline' ? 'offline' : termination ? (termination.owner ? termination.cause : 'waiting') : sessionError ?? 'offline';
    const candidates = getRememberedAccountSummaries().filter((account) => account.available && account.accountSlot && account.username.toLowerCase() !== recoveryUsername?.toLowerCase());
    return <SessionRecoveryScreen status={status} appearance={appearance} onCancelRecovery={cancelSessionRecovery} onContinueRecovery={continueWaitingRecovery} onAddAccountAuthenticated={completeRecoveryAddAccount} isContinuingRecovery={isContinuingRecovery} onRefresh={() => retryNetworkRecoveryRef.current()} isRefreshing={networkRefreshing} onTakeMeBack={() => { if (termination?.cause === 'deactivated' || termination?.cause === 'pending_deletion') { void completeTerminatedSession(termination.id, getSessionTerminationNotice()?.accountSlot); } else if (candidates.length > 0) setRecoveryChoice(true); else router.replace('/login?session_recovery=1'); }} onChooseLogin={() => { if (termination) clearSessionTermination(termination.id); clearAuthSession(); router.replace('/login?session_recovery=1'); }} accounts={recoveryAccounts} currentUsername={recoveryUsername} restoringAccountSlot={restoringAccountSlot} accountError={accountRecoveryError} onRestoreAccount={handleRestoreRememberedAccount} />;
  }

  return <AppShell key={`${user.id}-ready`} user={user} onLogout={handleLogout} logoutError={logoutError} initialScreen={initialScreen} initialSearchQuery={initialSearchQuery} onUserChange={setUser} connectionsUsername={connectionsUsername} initialConnectionsFilter={initialConnectionsFilter} initialHomeFilter={initialHomeFilter} initialMessagesTab={initialMessagesTab} initialSettingsTab={initialSettingsTab} initialSavedSection={initialSavedSection} />;
}
