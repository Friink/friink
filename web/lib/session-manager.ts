import {
  AuthApiError,
  clearAuthSessionForRecovery as legacyClearAuthSessionForRecovery,
  isTerminalRefreshFailure as legacyIsTerminalRefreshFailure,
  loadAuthSession as legacyLoadAuthSession,
  restoreAuthSessionForEntry as legacyRestoreAuthSessionForEntry,
  saveAuthSession as legacySaveAuthSession,
  type AuthSession,
  type AuthUser,
} from '@/lib/auth';

/**
 * Session-management migration seam.
 *
 * The auth module remains the legacy implementation for now. This module owns
 * the app-facing session contract and adds cross-tab rehydration so a token
 * update in one tab does not leave another tab with a stale in-memory session.
 * Domain authentication and API calls remain in auth.ts until this seam is
 * proven on staging.
 */

export type SessionChange =
  | { type: 'updated'; session: AuthSession }
  | { type: 'expired'; session: null };

let rehydrationPromise: Promise<AuthSession | null> | null = null;

export function getSession(): AuthSession | null {
  return legacyLoadAuthSession();
}

export function saveSession(session: AuthSession): void {
  legacySaveAuthSession(session);
}

export function clearSessionForRecovery(error: unknown): void {
  legacyClearAuthSessionForRecovery(error);
}

export function isTerminalSessionFailure(error: unknown): error is AuthApiError {
  return legacyIsTerminalRefreshFailure(error);
}

/**
 * Restore the current account through the legacy refresh implementation while
 * keeping this call behind the new session-manager contract. The existing
 * implementation remains the fallback path for the migration.
 */
export async function restoreSession(onSessionValidated?: (accountSlot: string) => void): Promise<AuthSession> {
  return legacyRestoreAuthSessionForEntry(onSessionValidated);
}

/**
 * Rehydrate this tab after another tab publishes a successful session update.
 * Access tokens are never copied between tabs; the existing HttpOnly slot
 * cookie is used by the legacy restore path instead.
 */
async function rehydrateSession(): Promise<AuthSession | null> {
  if (rehydrationPromise) return rehydrationPromise;

  rehydrationPromise = (async () => {
    try {
      const restored = await restoreSession();
      saveSession(restored);
      return restored;
    } catch {
      return null;
    } finally {
      rehydrationPromise = null;
    }
  })();

  return rehydrationPromise;
}

/**
 * Subscribe to session events relevant to an app shell. A session update is
 * not treated as logout: tabs without an in-memory session rehydrate first.
 */
export function subscribeToSessionChanges(onChange: (change: SessionChange) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleSessionUpdated = () => {
    const current = getSession();
    if (current) {
      onChange({ type: 'updated', session: current });
      return;
    }

    void rehydrateSession().then((restored) => {
      if (restored) onChange({ type: 'updated', session: restored });
    });
  };

  const handleSessionExpired = () => {
    onChange({ type: 'expired', session: null });
  };

  window.addEventListener('friink-session-updated', handleSessionUpdated);
  window.addEventListener('friink-session-expired', handleSessionExpired);
  return () => {
    window.removeEventListener('friink-session-updated', handleSessionUpdated);
    window.removeEventListener('friink-session-expired', handleSessionExpired);
  };
}

export type { AuthSession, AuthUser };
