import { AuthApiError, isTerminalRefreshFailure } from '@/lib/auth';

const MAX_RESTORE_ATTEMPTS = 4;
const RESTORE_RETRY_DELAY_MS = 10_000;

export function isNetworkRestoreFailure(error: unknown): boolean {
  const message = error instanceof AuthApiError ? error.detail : error instanceof Error ? error.message : '';
  return /failed to fetch|networkerror|network request failed|fetch failed|load failed|internet disconnected/i.test(message);
}

function waitForRetry(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Recovery cancelled.', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, RESTORE_RETRY_DELAY_MS);

    function abort() {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Recovery cancelled.', 'AbortError'));
    }

    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Retry only ambiguous session-entry failures; the auth operation stays authoritative. */
export async function restoreWithSessionRetries<T>(
  restore: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RESTORE_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Recovery cancelled.', 'AbortError');
    try {
      return await restore();
    } catch (error) {
      if (isTerminalRefreshFailure(error) || isNetworkRestoreFailure(error) || attempt === MAX_RESTORE_ATTEMPTS) throw error;
      await waitForRetry(signal);
    }
  }

  throw new Error('Session recovery ended unexpectedly.');
}
