'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, LoginForm } from '@friink/auth-ui';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function startLogin({ email, password }: { email: string; password: string }) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth-flow/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? 'Sorry, that didn’t work.'); return false; }
    return true;
  }

  async function finishLogin({ email, password, otp }: { email: string; password: string; otp: string }) {
    const returnTo = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('returnTo');
    let destination = '/';
    if (returnTo) {
      try {
        const target = new URL(returnTo, window.location.origin);
        if (target.origin === window.location.origin) destination = `${target.pathname}${target.search}${target.hash}`;
      } catch {
        // Ignore malformed or cross-origin return targets.
      }
    }
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth-flow/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, otp }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) setError(result.error ?? 'That code was not accepted.');
    else router.push(destination);
  }

  return <AuthShell><LoginForm busy={busy} error={error} onPasswordSubmit={startLogin} onOtpSubmit={finishLogin} onBack={() => router.push('/')} onSignup={() => router.push('/signup')} onForgotPassword={() => router.push('/forgot-password')} /></AuthShell>;
}
