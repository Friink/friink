import mixpanel from 'mixpanel-browser';

let initialized = false;

function initializeAnalytics(): boolean {
  if (typeof window === 'undefined' || initialized) return initialized;

  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim();
  if (!token) return false;

  try {
    mixpanel.init(token, {
      autocapture: false,
      track_pageview: false,
      persistence: 'localStorage',
    });
    initialized = true;
  } catch {
    return false;
  }
  return true;
}

export function identifyAnalyticsUser(userId: string): void {
  if (!initializeAnalytics() || !userId) return;
  try {
    mixpanel.identify(userId);
  } catch {
    // Analytics must never affect the application session.
  }
}

export function resetAnalyticsUser(): void {
  if (!initialized) return;
  try {
    mixpanel.reset();
  } catch {
    // Analytics must never affect the application session.
  }
}

export function trackAnalyticsEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initializeAnalytics()) return;
  try {
    mixpanel.track(event, properties);
  } catch {
    // Analytics must never affect navigation or rendering.
  }
}
