import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';

type SessionRecoveryScreenProps = {
  status: 'loading' | 'offline' | 'expired' | 'security';
  appearance?: 'light' | 'dark' | 'system';
  onRetry?: () => void;
};

export function SessionRecoveryScreen({ status, appearance = 'system', onRetry }: SessionRecoveryScreenProps) {
  if (status === 'loading') {
    return (
      <main className="lifecycle-screen" data-theme={appearance} aria-busy="true">
        <section className="lifecycle-card" aria-labelledby="session-loading-title">
          <BrandLockup size="lg" />
          <h1 id="session-loading-title">Reconnecting…</h1>
          <p>Just a moment while we get you back in.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="lifecycle-screen" data-theme={appearance}>
      <a className="lifecycle-home-link" href="/" aria-label="Return to Friink home"><FriinkLogo /></a>
      <section className="lifecycle-card" aria-labelledby="session-recovery-title">
        <BrandLockup size="lg" />
        <h1 id="session-recovery-title">We couldn’t restore this session.</h1>
        <p>{status === 'offline' ? 'Friink is having trouble reconnecting. Your account has not been signed out.' : status === 'security' ? 'For your security, your session ended. Please sign in again.' : 'Your session has expired or is no longer available. Sign in again to continue.'}</p>
        <div className="lifecycle-actions">
          {status === 'offline' && onRetry ? <button className="button-primary" type="button" onClick={onRetry}>Try again</button> : null}
          <a className="button-secondary" href="/login">Go to login</a>
        </div>
      </section>
    </main>
  );
}
