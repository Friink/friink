import {
  clearAuthSessionForRecovery as legacyClearAuthSessionForRecovery,
  loadAuthSession as legacyLoadAuthSession,
  saveAuthSession as legacySaveAuthSession,
  type AuthSession,
} from '@/lib/auth';

/**
 * Session storage boundary for the migration away from auth.ts.
 *
 * The legacy functions remain the backing store during staging verification.
 * No access or refresh credentials are copied into a second browser store.
 */
export function readSession(): AuthSession | null {
  return legacyLoadAuthSession();
}

export function writeSession(session: AuthSession): void {
  legacySaveAuthSession(session);
}

export function preserveFailedSession(error: unknown): void {
  legacyClearAuthSessionForRecovery(error);
}
