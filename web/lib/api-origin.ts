const LOCAL_API_ORIGIN = 'http://localhost:8000';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getApiOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredOrigin) {
    return trimTrailingSlash(configuredOrigin);
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
