'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, SignupForm, type SignupSubmit } from '@friink/auth-ui';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp(email: string) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth-flow/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, purpose: 'signup' }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? 'We could not send a verification code.'); return false; }
    return true;
  }

  async function verifyOtp(value: { email: string; otp: string }) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth-flow/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? 'That code was not accepted.'); return false; }
    return true;
  }

  async function submit(value: SignupSubmit) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth-flow/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) setError(result.error ?? 'Sorry, that didn’t work.');
    else router.push('/');
  }

  return <AuthShell><SignupForm busy={busy} error={error} onEmailSubmit={sendOtp} onOtpSubmit={verifyOtp} onSubmit={submit} onBack={() => router.back()} onLogin={() => router.push('/login')} /></AuthShell>;
}
