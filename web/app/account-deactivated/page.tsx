'use client';

import { useState } from 'react';
import { clearDeactivationFallbackSlot, getDeactivationFallbackSlot, restoreAccountSession } from '@/lib/auth';
import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';

export default function AccountDeactivatedPage() {
  const [fallbackSlot] = useState(() => getDeactivationFallbackSlot());
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  async function handleReturn() {
    if (!fallbackSlot) {
      clearDeactivationFallbackSlot();
      window.location.assign('/');
      return;
    }
    setIsRestoring(true);
    setRestoreError('');
    try {
      await restoreAccountSession(fallbackSlot);
      clearDeactivationFallbackSlot();
      window.location.assign('/home/explore');
    } catch {
      clearDeactivationFallbackSlot();
      setRestoreError('The other account could not be restored. You can return to the public site.');
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <main className="lifecycle-screen">
      <a className="lifecycle-home-link" href="/" aria-label="Back to Friink home">
        <FriinkLogo />
      </a>
      <section className="lifecycle-card" aria-labelledby="account-deactivated-title">
        <BrandLockup size="md" />
        <h1 id="account-deactivated-title">Your account is deactivated</h1>
        <p>All sessions have been logged out. Your profile and public content are unavailable to others.</p>
        <p>Existing chats remain readable but are now read-only, and new messages cannot be sent.</p>
        {fallbackSlot ? <p>Your most recent other account is still available on this device.</p> : null}
        <p>If you have an uncancelled subscription, billing may continue. Deactivation does not pause or cancel it.</p>
        <p>You can return anytime by signing in and completing account reactivation.</p>
        {restoreError ? <p className="lifecycle-error" role="alert">{restoreError}</p> : null}
        <button className="pill-button pill-button-brand lifecycle-action" type="button" onClick={() => void handleReturn()} disabled={isRestoring}>
          {isRestoring ? 'Please wait...' : fallbackSlot ? 'Go Back' : 'Go to public site'}
        </button>
      </section>
    </main>
  );
}
