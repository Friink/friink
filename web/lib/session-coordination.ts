import type { AuthSession } from '@/lib/auth';

export type SessionCoordinationEvent =
  | { type: 'updated'; session: AuthSession | null }
  | { type: 'expired'; session: null };

type SessionEventHandler = (event: SessionCoordinationEvent) => void;

/**
 * Browser event boundary for session coordination.
 *
 * auth.ts still emits the events while the migration is staged. This module
 * owns the subscription contract so consumers do not bind directly to browser
 * event names or BroadcastChannel details.
 */
export function subscribeToSessionEvents(handler: SessionEventHandler): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onUpdated = (event: Event) => {
    const detail = (event as CustomEvent<{ session?: AuthSession }>).detail;
    handler({ type: 'updated', session: detail?.session ?? null });
  };
  const onExpired = () => handler({ type: 'expired', session: null });

  window.addEventListener('friink-session-updated', onUpdated);
  window.addEventListener('friink-session-expired', onExpired);
  return () => {
    window.removeEventListener('friink-session-updated', onUpdated);
    window.removeEventListener('friink-session-expired', onExpired);
  };
}
