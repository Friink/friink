'use client';

import { useState } from 'react';
import { clearDeactivationFallbackSlot, getDeactivationFallbackSlots, restoreAccountSession, saveAuthSession, setDeactivationFallbackSlots } from '@/lib/auth';
import { BrandLockup } from '@/components/design/brand-lockup';
import { FriinkLogo } from '@/components/friink-logo';

export default function AccountDeactivatedPage() {
  const [fallbackSlots, setFallbackSlots] = useState(() => getDeactivationFallbackSlots());
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  async function handleReturn() {
    if (fallbackSlots.length === 0) {
      clearDeactivationFallbackSlot();
      window.location.assign('/');
      return;
    }
    setIsRestoring(true);
    setRestoreError('');
    for (const accountSlot of fallbackSlots) {
      try {
        const restoredSession = await restoreAccountSession(accountSlot);
        saveAuthSession(restoredSession);
        clearDeactivationFallbackSlot();
        window.location.assign('/home/explore');
        return;
      } catch {
        // Try the next most-recent remembered account before showing failure.
      }
    }
    setFallbackSlots(fallbackSlots);
    setDeactivationFallbackSlots(fallbackSlots);
    setRestoreError('We could not reopen another account right now. You can try again or return to the public site.');
    setIsRestoring(false);
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
        {fallbackSlots.length > 0 ? <p>Your other remembered accounts are still available on this device.</p> : null}
        <p>If you have an uncancelled subscription, billing may continue. Deactivation does not pause or cancel it.</p>
        <p>You can return anytime by signing in and completing account reactivation.</p>
        {restoreError ? <p className="lifecycle-error" role="alert">{restoreError}</p> : null}
        <button className="pill-button pill-button-brand lifecycle-action" type="button" onClick={() => void handleReturn()} disabled={isRestoring}>
          {isRestoring ? 'Please wait...' : fallbackSlots.length > 0 ? 'Try again' : 'Go to public site'}
        </button>
      </section>
    </main>
  );
}
