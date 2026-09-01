import { getUnreadNotificationCount } from '@/lib/auth';

export interface NotificationPollingTransport {
  subscribe(onCount: (count: number) => void): () => void;
}

export class PollingNotificationTransport implements NotificationPollingTransport {
  private readonly getAccessToken: () => string | null;
  private readonly intervalMs: number;

  constructor(getAccessToken: () => string | null, intervalMs = 4000) {
    this.getAccessToken = getAccessToken;
    this.intervalMs = intervalMs;
  }

  subscribe(onCount: (count: number) => void) {
    let stopped = false;
    let busy = false;
    let timer: number | null = null;
    let failures = 0;

    const poll = async () => {
      if (stopped || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const accessToken = this.getAccessToken();
        if (!accessToken) return;
        const response = await getUnreadNotificationCount(accessToken);
        failures = 0;
        onCount(response.count);
      } catch {
        failures += 1;
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      if (stopped) return;
      const delay = failures > 0 ? Math.min(this.intervalMs * (2 ** failures), 30000) : this.intervalMs;
      timer = window.setTimeout(async () => {
        await poll();
        schedule();
      }, delay);
    };
    const resume = () => { void poll(); };

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    void poll();
    schedule();

    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }
}
