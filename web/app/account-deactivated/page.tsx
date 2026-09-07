'use client';

import { useState } from 'react';
import { clearDeactivationFallbackSlot, getDeactivationFallbackSlot, restoreAccountSession } from '@/lib/auth';

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
    <main className="login-screen">
      <section className="login-form" aria-labelledby="account-deactivated-title">
        <h1 id="account-deactivated-title">Your account is deactivated</h1>
        <p>This account is deactivated. Its profile and public content are unavailable for now.</p>
        {fallbackSlot ? <p>Your most recent other account is still available on this device.</p> : null}
        <p>If you have an uncancelled subscription, billing may continue. You can come back anytime and reactivate your account with a verified login.</p>
        {restoreError ? <p className="login-error" role="alert">{restoreError}</p> : null}
        <button className="login-submit" type="button" onClick={() => void handleReturn()} disabled={isRestoring}>
          {isRestoring ? 'Please wait...' : fallbackSlot ? 'Go Back' : 'Go to public site'}
        </button>
      </section>
    </main>
  );
}
