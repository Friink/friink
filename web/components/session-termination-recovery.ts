import type { MutableRefObject } from 'react';
import {
  clearAuthSession,
  clearSessionTermination,
  getRememberedAccountSummaries,
  getSessionTerminationNotice,
  isSessionTerminationOwner,
  restoreRememberedAccountWithFallback,
  runSessionTerminationAction,
  type AccountSummary,
  type AuthUser,
  type SessionTerminationCause,
} from '@/lib/auth';
import { getSession, saveSession } from '@/lib/session-manager';
import { isNetworkRestoreFailure } from '@/lib/session-recovery';

type TerminationState = { id: string; cause: SessionTerminationCause; owner: boolean } | null;
type SessionError = 'network' | 'offline' | 'expired' | 'security' | null;
type Router = { replace(path: string): void };

type RecoveryDependencies = {
  router: Router;
  sessionRecoveryInFlight: MutableRefObject<boolean>;
  networkRestoreTerminationId: MutableRefObject<string | null>;
  setIsContinuingRecovery: (value: boolean) => void;
  setTermination: (value: TerminationState) => void;
  setUser: (value: AuthUser | null) => void;
  setSessionReady: (value: boolean) => void;
  setSessionError: (value: SessionError) => void;
  setRecoveryChoice: (value: boolean) => void;
  setAuthCheckComplete: (value: boolean) => void;
  setRecoveryAccounts: (value: AccountSummary[]) => void;
};

export async function completeSessionTerminationRecovery(
  dependencies: RecoveryDependencies,
  id: string,
  failedSlot?: string | null,
): Promise<void> {
  const { sessionRecoveryInFlight, setIsContinuingRecovery } = dependencies;
  if (sessionRecoveryInFlight.current) return;
  sessionRecoveryInFlight.current = true;
  setIsContinuingRecovery(true);
  try {
    const action = await runSessionTerminationAction(id, async () => {
      const notice = getSessionTerminationNotice();
      const fallback = await restoreRememberedAccountWithFallback(
        failedSlot ? [failedSlot] : notice?.accountSlot ? [notice.accountSlot] : [],
      );
      if (fallback) saveSession(fallback);
      else clearAuthSession();
      clearSessionTermination(id);
      return fallback;
    });
    if (!action.performed) {
      const notice = getSessionTerminationNotice();
      if (notice) {
        dependencies.setTermination({ id: notice.id, cause: notice.cause, owner: isSessionTerminationOwner(notice.id) });
      } else {
        const currentSession = getSession();
        if (currentSession) {
          dependencies.setUser(currentSession.user);
          dependencies.setSessionReady(true);
          dependencies.setSessionError(null);
          dependencies.setAuthCheckComplete(true);
        } else {
          dependencies.setTermination(null);
          dependencies.router.replace('/');
        }
      }
      return;
    }
    const fallback = action.result ?? null;
    dependencies.networkRestoreTerminationId.current = null;
    if (fallback) {
      dependencies.setUser(fallback.user);
      dependencies.setSessionReady(true);
      dependencies.setSessionError(null);
      dependencies.setTermination(null);
      dependencies.setRecoveryChoice(false);
      dependencies.setAuthCheckComplete(true);
      dependencies.router.replace('/home');
    } else {
      clearAuthSession();
      dependencies.setTermination(null);
      dependencies.setRecoveryChoice(false);
      dependencies.router.replace('/');
    }
  } catch (error) {
    dependencies.networkRestoreTerminationId.current = id;
    dependencies.setSessionError(isNetworkRestoreFailure(error) ? 'network' : 'offline');
    dependencies.setRecoveryAccounts(getRememberedAccountSummaries());
    dependencies.setAuthCheckComplete(true);
  } finally {
    sessionRecoveryInFlight.current = false;
    setIsContinuingRecovery(false);
  }
}
