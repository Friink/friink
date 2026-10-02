import { FriinkLogo } from '@/components/friink-logo';

export function AppEntryFrame({
  message,
  onRetry,
  onTakeMeBack,
  retrying = false,
  appearance = 'system',
}: {
  message?: string;
  onRetry?: () => void;
  onTakeMeBack?: () => void;
  retrying?: boolean;
  appearance?: 'light' | 'dark' | 'system';
}) {
  return (
    <main className="app-shell app-entry-frame" data-theme={appearance} aria-busy="true">
      <p className="sr-only" role="status">Loading your page.</p>
      <aside className="app-entry-sidebar" aria-hidden="true">
        <FriinkLogo />
        <span className="app-entry-line app-entry-line-short" />
        <span className="app-entry-line" />
        <span className="app-entry-line" />
        <span className="app-entry-line" />
      </aside>
      <section className="app-entry-main" aria-hidden="true">
        <header className="app-entry-topbar"><span className="app-entry-line app-entry-line-short" /></header>
        <div className="app-entry-content">
          <div className="app-entry-placeholder">
            <span className="app-entry-line app-entry-line-medium" />
            <span className="app-entry-line" />
            <span className="app-entry-line app-entry-line-long" />
            <span className="app-entry-line app-entry-line-short" />
          </div>
        </div>
      </section>
      {message ? (
        <section className="app-entry-notice" role="alert">
          <p>{message}</p>
          {onRetry ? <button className="button-primary" type="button" onClick={onRetry} disabled={retrying}>{retrying ? 'Checking…' : 'Try again'}</button> : null}
          {onTakeMeBack ? <button className="button-secondary" type="button" onClick={onTakeMeBack}>Go to public site</button> : null}
        </section>
      ) : null}
    </main>
  );
}
