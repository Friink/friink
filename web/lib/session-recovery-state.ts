const PUBLIC_SESSION_FAILURE_KEY = 'friink-public-after-session-failure';

export function rememberPublicSessionFailure(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(PUBLIC_SESSION_FAILURE_KEY, '1');
  } catch {
    // The public-route query marker still protects this navigation.
  }
}

export function hasPublicSessionFailure(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PUBLIC_SESSION_FAILURE_KEY) === '1';
  } catch {
    return false;
  }
}
