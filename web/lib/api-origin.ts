const LOCAL_API_ORIGIN = 'http://localhost:8000';
const API_REQUEST_TIMEOUT_MS = 15000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getConfiguredApiOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredOrigin) {
    return trimTrailingSlash(configuredOrigin);
  }
  return null;
}

export function getApiOrigin() {
  const configuredOrigin = getConfiguredApiOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window === 'undefined') {
    return LOCAL_API_ORIGIN;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return LOCAL_API_ORIGIN;
  }

  throw new Error('Friink API is not configured for this environment. Set NEXT_PUBLIC_API_BASE_URL on the web deployment.');
}

export async function fetchApi(path: string, init?: RequestInit) {
  const origin = getApiOrigin();
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);
  const abortListener = () => controller.abort();
  init?.signal?.addEventListener('abort', abortListener, { once: true });
  try {
    return await fetch(`${origin}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    throw timedOut ? new Error('The request timed out.') : error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', abortListener);
  }
}
