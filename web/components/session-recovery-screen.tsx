import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';
import { Modal } from '@/components/modal';
import type { AccountSummary } from '@/lib/auth';

type SessionRecoveryScreenProps = {
  status: 'loading' | 'offline' | 'expired' | 'security';
  appearance?: 'light' | 'dark' | 'system';
  onRetry?: () => void;
  accounts?: AccountSummary[];
  currentUsername?: string | null;
  restoringAccountSlot?: string | null;
  accountError?: string | null;
  onRestoreAccount?: (account: AccountSummary) => void;
};

export function SessionRecoveryScreen({ status, appearance = 'system', onRetry, accounts = [], currentUsername, restoringAccountSlot, accountError, onRestoreAccount }: SessionRecoveryScreenProps) {
  const [showAccounts, setShowAccounts] = useState(false);
  const orderedAccounts = [...accounts].sort((a, b) => Number(b.active) - Number(a.active) || b.lastUsedAt.localeCompare(a.lastUsedAt));
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
    <>
      <main className="lifecycle-screen" data-theme={appearance}>
        <Link className="lifecycle-home-link" href="/" aria-label="Return to Friink home"><FriinkLogo /></Link>
        <section className="lifecycle-card" aria-labelledby="session-recovery-title">
          <BrandLockup size="lg" />
          <h1 id="session-recovery-title">We couldn’t restore this session.</h1>
          <p>{status === 'offline' ? 'Friink is having trouble reconnecting. Your account has not been signed out.' : status === 'security' ? 'For your security, your session ended. Please sign in again.' : 'Your session has expired or is no longer available. Sign in again to continue.'}</p>
          <div className={`lifecycle-actions session-recovery-actions${status === 'offline' ? ' session-recovery-actions-offline' : ' session-recovery-actions-terminal'}`}>
            {status === 'offline' && onRetry ? <button className="button-primary" type="button" onClick={onRetry}>Try again</button> : null}
            {status !== 'offline' && currentUsername ? <Link className="button-primary" href={`/login?${new URLSearchParams({ account: currentUsername, reason: status === 'security' ? 'security-revocation' : 'expired' }).toString()}`}>Sign in as @{currentUsername}</Link> : <Link className="button-secondary" href="/login">Go to login</Link>}
            {accounts.length > 0 && onRestoreAccount ? <button className="button-secondary" type="button" disabled={!!restoringAccountSlot} aria-haspopup="dialog" aria-expanded={showAccounts} onClick={() => setShowAccounts(true)}>Choose another remembered account</button> : null}
          </div>
        </section>
      </main>
      {showAccounts && onRestoreAccount ? <Modal title="Choose another account" onClose={() => setShowAccounts(false)} closeLabel="Close remembered accounts" className="session-recovery-account-modal" actions={<button className="button-secondary" type="button" disabled={!!restoringAccountSlot} onClick={() => setShowAccounts(false)}>Cancel</button>}>
        <div className="session-recovery-accounts" role="group" aria-label="Remembered accounts" aria-busy={!!restoringAccountSlot}>
          {orderedAccounts.map((account) => <button className={`session-recovery-account${account.active ? ' session-recovery-account-current' : ''}`} type="button" key={account.accountSlot} disabled={!!restoringAccountSlot} onClick={() => onRestoreAccount(account)}><Image src={account.profilePictureUrl || '/media/profile.jpg'} alt="" width={32} height={32} sizes="32px" unoptimized/><span>@{account.username}{account.active ? ' (current)' : ''}</span>{restoringAccountSlot === account.accountSlot ? <i className="fa-solid fa-spinner fa-spin" aria-label="Restoring account" /> : account.active ? <i className="fa-solid fa-check" aria-label="Current account" /> : null}</button>)}
        </div>
        {accountError ? <p className="session-recovery-error" role="alert">{accountError}</p> : null}
      </Modal> : null}
    </>
  );
}
