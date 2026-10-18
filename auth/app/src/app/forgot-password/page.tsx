'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, ForgotPasswordForm } from '@friink/auth-ui';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp(email: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    const response = await fetch('/api/auth-flow/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, purpose: 'password-reset' }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? 'We could not send a verification code.'); return false; }
    return true;
  }

  async function resetPassword(value: { email: string; otp: string; password: string }) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth/email-otp/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value.email, otp: value.otp, password: value.password }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) setError(result.error ?? 'That code is invalid or expired.');
    else { setSuccess('Your password was reset. You can now log in.'); router.push('/login'); }
  }

  return <AuthShell><ForgotPasswordForm busy={busy} error={error} success={success} onSendOtp={sendOtp} onSubmit={resetPassword} onBack={() => router.push('/login')} /></AuthShell>;
}
