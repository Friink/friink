import {
  AuthApiError,
  isTerminalRefreshFailure as legacyIsTerminalRefreshFailure,
  restoreAuthSessionForEntry as legacyRestoreAuthSessionForEntry,
  type AuthSession,
  type AuthUser,
} from '@/lib/auth';
import { subscribeToSessionEvents, type SessionCoordinationEvent } from '@/lib/session-coordination';
import { preserveFailedSession, readSession, writeSession } from '@/lib/session-store';

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
  return readSession();
}

export function saveSession(session: AuthSession): void {
  writeSession(session);
}

export function clearSessionForRecovery(error: unknown): void {
  preserveFailedSession(error);
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
  const handleSessionUpdated = async (event: SessionCoordinationEvent) => {
    if (event.type !== 'updated') return;
    const current = getSession();
    if (current) {
      onChange({ type: 'updated', session: current });
      return;
    }

    void rehydrateSession().then((restored) => {
      if (restored) onChange({ type: 'updated', session: restored });
    });
  };
  return subscribeToSessionEvents((event) => {
    if (event.type === 'expired') onChange(event);
    else void handleSessionUpdated(event);
  });
}

export type { AuthSession, AuthUser };
