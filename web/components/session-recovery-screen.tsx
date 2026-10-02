import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';
import { AppEntryFrame } from '@/components/app-entry-frame';
import { LoginScreen } from '@/components/login-screen';
import { Modal } from '@/components/modal';
import type { AccountSummary, AuthUser } from '@/lib/auth';
import { clearAuthSession, clearSessionTermination } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { rememberPublicSessionFailure } from '@/lib/session-recovery-state';

type SessionRecoveryStatus = 'loading' | 'network' | 'offline' | 'choice' | 'expired' | 'security' | 'terminated' | 'deactivated' | 'pending_deletion' | 'waiting';

type SessionRecoveryScreenProps = {
  status: SessionRecoveryStatus;
  appearance?: 'light' | 'dark' | 'system';
  onCancelRecovery?: () => void;
  onAddAccountAuthenticated?: (user: AuthUser) => void;
  onTakeMeBack?: () => void;
  onContinueRecovery?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isContinuingRecovery?: boolean;
  onChooseLogin?: () => void;
  accounts?: AccountSummary[];
  currentUsername?: string | null;
  restoringAccountSlot?: string | null;
  accountError?: string | null;
  onRestoreAccount?: (account: AccountSummary) => void;
  accountsLoading?: boolean;
  onDiscoverAccounts?: () => void;
  loadingMessage?: string;
};

const messages: Record<Exclude<SessionRecoveryStatus, 'loading' | 'network' | 'offline' | 'choice' | 'waiting'>, { title: string }> = {
  expired: { title: 'Session ended' },
  security: { title: 'Session ended' },
  terminated: { title: 'Session ended' },
  deactivated: { title: 'Session ended' },
  pending_deletion: { title: 'Session ended' },
};

export function SessionRecoveryScreen({ status, appearance = 'system', onCancelRecovery, onAddAccountAuthenticated, onTakeMeBack, onContinueRecovery, onRefresh, isRefreshing = false, isContinuingRecovery = false, onChooseLogin, accounts = [], currentUsername, restoringAccountSlot, accountError, onRestoreAccount, accountsLoading = false, onDiscoverAccounts, loadingMessage }: SessionRecoveryScreenProps) {
  const router = useRouter();
  const [showChoice, setShowChoice] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const discoveryStatusRef = useRef<SessionRecoveryStatus | null>(null);
  const availableAccounts = accounts
    .filter((account) => account.available && account.accountSlot && account.username.toLowerCase() !== currentUsername?.toLowerCase())
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  const isAuthTerminalStatus = status === 'expired' || status === 'security' || status === 'terminated';
  const isTerminalStatus = status === 'deactivated' || status === 'pending_deletion';
  const hasAvailableAccounts = availableAccounts.length > 0;
  const discoveryPending = isTerminalStatus && (accountsLoading || discoveryStatusRef.current !== status);

  useEffect(() => {
    if (!isAuthTerminalStatus) return;
    clearAuthSession();
    clearSessionTermination();
    rememberPublicSessionFailure();
    router.replace('/?session_recovery=failed');
  }, [isAuthTerminalStatus, router]);

  useEffect(() => {
    if (!isTerminalStatus || discoveryStatusRef.current === status) return;
    discoveryStatusRef.current = status;
    onDiscoverAccounts?.();
  }, [isTerminalStatus, onDiscoverAccounts, status]);

  if (showAddAccount) {
    return (
      <main className="lifecycle-screen" data-theme={appearance}>
        <Modal title="Add account" onClose={() => setShowAddAccount(false)} closeLabel="Return to session options" className="account-auth-modal">
          <LoginScreen mode="account-modal" onAuthenticated={(user) => { setShowAddAccount(false); onAddAccountAuthenticated?.(user); }} />
        </Modal>
      </main>
    );
  }

  if (status === 'loading') {
    return <AppEntryFrame appearance={appearance} message={loadingMessage ?? 'Checking your session…'} onTakeMeBack={onTakeMeBack} />;
  }

  if (isAuthTerminalStatus) return <AppEntryFrame appearance={appearance} message="Your session ended. Returning to the public site…" />;

  if (status === 'network') {
    return (
      <main className="lifecycle-screen" data-theme={appearance} aria-live="polite" aria-busy={isRefreshing}>
        <section className="lifecycle-card" aria-labelledby="session-network-title">
          <BrandLockup size="lg" />
          <h1 id="session-network-title">We can’t connect</h1>
          <p>We couldn’t restore your session after several attempts. Try again when your connection is available, or return to the public site.</p>
          <div className="lifecycle-actions session-recovery-actions session-recovery-actions-terminal">
            <button className="button-primary" type="button" onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Checking…' : 'Try again'}
            </button>
            <button className="button-secondary" type="button" onClick={onTakeMeBack}>Go to public site</button>
          </div>
        </section>
      </main>
    );
  }

  if (status === 'choice' || (status === 'offline' && showChoice)) {
    return (
      <main className="lifecycle-screen" data-theme={appearance}>
        <Modal
          title="Continue to Friink"
          onClose={onChooseLogin ?? (() => undefined)}
          closeLabel="Continue to login"
          closeOnBackdrop={false}
          className="session-recovery-account-modal"
          actions={<button className="button-secondary" type="button" onClick={onChooseLogin}>Log in</button>}
        >
          <p>Choose a remembered account to continue, or log in.</p>
          {availableAccounts.length > 0 && onRestoreAccount ? (
            <div className="session-recovery-accounts" role="group" aria-label="Remembered accounts" aria-busy={!!restoringAccountSlot}>
              {availableAccounts.map((account) => (
                <button className="session-recovery-account" type="button" key={account.accountSlot} disabled={!!restoringAccountSlot} onClick={() => onRestoreAccount(account)}>
                  <Image src={account.profilePictureUrl || '/media/profile.jpg'} alt="" width={32} height={32} sizes="32px" unoptimized />
                  <span>@{account.username}</span>
                  {restoringAccountSlot === account.accountSlot ? <i className="fa-solid fa-spinner fa-spin" aria-label="Restoring account" /> : null}
                </button>
              ))}
            </div>
          ) : null}
          {accountError ? <p className="session-recovery-error" role="alert">{accountError}</p> : null}
        </Modal>
      </main>
    );
  }

  if (status === 'offline') {
    return (
      <main className="lifecycle-screen" data-theme={appearance}>
        <Link className="lifecycle-home-link" href="/" aria-label="Return to Friink home"><FriinkLogo /></Link>
        <section className="lifecycle-card" aria-labelledby="session-recovery-title">
          <BrandLockup size="lg" />
          <h1 id="session-recovery-title">We couldn’t restore your session.</h1>
          <p>We couldn’t confirm your session after several attempts. You can try again or return to the public site.</p>
          <div className="lifecycle-actions session-recovery-actions session-recovery-actions-terminal">
            <button className="button-primary" type="button" onClick={onRefresh} disabled={isRefreshing}>{isRefreshing ? 'Checking…' : 'Try again'}</button>
            <button className="button-secondary" type="button" onClick={onTakeMeBack}>Go to public site</button>
          </div>
        </section>
      </main>
    );
  }

  if (status === 'waiting') {
    return (
      <main className="lifecycle-screen" data-theme={appearance} aria-live="polite">
        <section className="lifecycle-card" aria-labelledby="session-waiting-title">
          <BrandLockup size="lg" />
          <h1 id="session-waiting-title">Session ended</h1>
          <p>Continue recovery in this tab, or return to the tab already handling it.</p>
          <div className="lifecycle-actions session-recovery-actions session-recovery-actions-terminal">
            <button className="button-primary" type="button" onClick={onContinueRecovery} disabled={isContinuingRecovery}>
              {isContinuingRecovery ? 'Continuing…' : 'Continue here'}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const message = messages[status];
  const canCloseRecovery = !discoveryPending && !hasAvailableAccounts;
  return (
    <main className="lifecycle-screen" data-theme={appearance}>
      <Modal
        title={message.title}
        onClose={canCloseRecovery ? (onCancelRecovery ?? (() => undefined)) : (() => undefined)}
        closeLabel="Continue without this session"
        closeOnBackdrop={false}
        closeDisabled={!canCloseRecovery || isContinuingRecovery || !!restoringAccountSlot}
        showClose={canCloseRecovery}
        className="session-recovery-account-modal"
        actions={<>
          {canCloseRecovery ? <button className="button-secondary" type="button" onClick={onCancelRecovery} disabled={isContinuingRecovery || !!restoringAccountSlot}>Close</button> : null}
          <button className="button-primary" type="button" onClick={() => setShowAddAccount(true)} disabled={discoveryPending || isContinuingRecovery || !!restoringAccountSlot}>Add account</button>
        </>}
      >
        <p className="session-recovery-copy">Your session has ended. Choose how you’d like to continue.</p>
        {discoveryPending ? <p role="status">Checking your remembered accounts…</p> : null}
        {hasAvailableAccounts && onRestoreAccount ? (
          <div className="session-recovery-accounts" role="group" aria-label="Available accounts" aria-busy={!!restoringAccountSlot}>
            {availableAccounts.map((account) => (
              <button className="session-recovery-account" type="button" key={account.accountSlot} disabled={!!restoringAccountSlot || isContinuingRecovery} onClick={() => onRestoreAccount(account)}>
                <Image src={account.profilePictureUrl || '/media/profile.jpg'} alt="" width={32} height={32} sizes="32px" unoptimized />
                <span>@{account.username}</span>
                {restoringAccountSlot === account.accountSlot ? <i className="fa-solid fa-spinner fa-spin" aria-label="Restoring account" /> : null}
              </button>
            ))}
          </div>
        ) : null}
        {accountError ? <p className="session-recovery-error" role="alert">{accountError}</p> : null}
      </Modal>
    </main>
  );
}
