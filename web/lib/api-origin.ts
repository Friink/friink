const LOCAL_API_ORIGIN = 'http://localhost:8000';
const PRODUCTION_API_ORIGIN = 'https://api.friink.com';
const STAGING_API_ORIGIN = 'https://staging-api.friink.com';
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

export function getApiOriginCandidates() {
  const primaryOrigin = getApiOrigin();
  const candidates = [primaryOrigin];

  if (primaryOrigin === STAGING_API_ORIGIN) {
    candidates.push(PRODUCTION_API_ORIGIN);
  }

  return candidates;
}

export async function fetchApi(path: string, init?: RequestInit) {
  let lastError: Error | null = null;
  const method = (init?.method || 'GET').toUpperCase();
  const isSafeToRetryAcrossOrigins = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const origins = isSafeToRetryAcrossOrigins ? getApiOriginCandidates() : [getApiOrigin()];

  for (const origin of origins) {
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
      lastError = timedOut ? new Error('The request timed out.') : error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeoutId);
      init?.signal?.removeEventListener('abort', abortListener);
    }
  }

  throw lastError ?? new Error('Friink API request failed.');
}
