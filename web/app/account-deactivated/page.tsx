'use client';

import { useState } from 'react';
import { clearDeactivationFallbackSlot, getDeactivationFallbackSlots, restoreAccountSession, saveAuthSession, setDeactivationFallbackSlots } from '@/lib/auth';
import { Modal } from '@/components/modal';

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
        window.location.assign('/');
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
      <Modal
        title="Account Deactivated"
        onClose={() => void handleReturn()}
        closeLabel="Okay"
        className="account-deactivated-modal"
        actions={<button className="pill-button pill-button-brand" type="button" onClick={() => void handleReturn()} disabled={isRestoring}>{isRestoring ? 'Please wait...' : 'Okay'}</button>}
      >
        <p>All sessions for this account have been logged out. Your profile and public content are unavailable to others.</p>
        <p>Existing chats remain readable but are now read-only. If you have another remembered account on this device, it will be restored automatically.</p>
        <p>If you have an uncancelled subscription, billing may continue. You can reactivate this account anytime by signing in again.</p>
        {restoreError ? <p className="lifecycle-error" role="alert">{restoreError}</p> : null}
      </Modal>
    </main>
  );
}
