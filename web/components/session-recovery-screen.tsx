import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';
import { Modal } from '@/components/modal';
import type { AccountSummary } from '@/lib/auth';

type SessionRecoveryStatus = 'loading' | 'offline' | 'choice' | 'expired' | 'security' | 'terminated' | 'deactivated' | 'pending_deletion' | 'waiting';

type SessionRecoveryScreenProps = {
  status: SessionRecoveryStatus;
  appearance?: 'light' | 'dark' | 'system';
  onAcknowledge?: () => void;
  onTakeMeBack?: () => void;
  onChooseLogin?: () => void;
  accounts?: AccountSummary[];
  currentUsername?: string | null;
  restoringAccountSlot?: string | null;
  accountError?: string | null;
  onRestoreAccount?: (account: AccountSummary) => void;
};

const messages: Record<Exclude<SessionRecoveryStatus, 'loading' | 'offline' | 'choice' | 'waiting'>, { title: string; body: string }> = {
  expired: { title: 'Session ended', body: 'Your session is no longer active.' },
  security: { title: 'Session ended', body: 'Your session was ended for security reasons.' },
  terminated: { title: 'Session ended', body: 'This session was ended from another device.' },
  deactivated: { title: 'Session ended', body: 'This account was deactivated on another device.' },
  pending_deletion: { title: 'Session ended', body: 'This account is scheduled for deletion.' },
};

export function SessionRecoveryScreen({ status, appearance = 'system', onAcknowledge, onTakeMeBack, onChooseLogin, accounts = [], currentUsername, restoringAccountSlot, accountError, onRestoreAccount }: SessionRecoveryScreenProps) {
  const [showChoice, setShowChoice] = useState(false);
  const availableAccounts = accounts
    .filter((account) => account.available && account.accountSlot && account.username.toLowerCase() !== currentUsername?.toLowerCase())
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));

  if (status === 'loading') {
    return (
      <main className="lifecycle-screen" data-theme={appearance} aria-busy="true">
        <section className="lifecycle-card" aria-labelledby="session-loading-title">
          <BrandLockup size="lg" />
          <h1 id="session-loading-title">We’re having trouble reconnecting.</h1>
          <p>We’re trying to restore your session.</p>
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
          <p>Use the button below to continue.</p>
          <div className="lifecycle-actions session-recovery-actions session-recovery-actions-terminal">
            <button className="button-primary" type="button" onClick={() => { if (availableAccounts.length > 0 && onRestoreAccount && onChooseLogin) setShowChoice(true); else onTakeMeBack?.(); }}>Take me back</button>
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
          <p>Another tab will continue after the session notice is acknowledged.</p>
        </section>
      </main>
    );
  }

  const message = messages[status];
  return (
    <main className="lifecycle-screen" data-theme={appearance}>
      <Modal
        title={message.title}
        onClose={onAcknowledge ?? (() => undefined)}
        closeLabel="Close session notice"
        closeOnBackdrop={false}
        className="session-recovery-account-modal"
        actions={<button className="button-primary" type="button" onClick={onAcknowledge}>Okay</button>}
      >
        <p>{message.body}</p>
      </Modal>
    </main>
  );
}
