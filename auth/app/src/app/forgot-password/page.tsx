'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, ForgotPasswordForm } from '@friink/auth-ui';
import { authClient } from '@/lib/auth-client';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(email: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setBusy(false);
    if (result.error) setError(result.error.message ?? 'We could not send reset instructions.');
    else setSuccess('If an account exists for that email, password-reset instructions have been sent.');
  }

  return <AuthShell><ForgotPasswordForm busy={busy} error={error} success={success} onSubmit={submit} onBack={() => router.push('/login')} /></AuthShell>;
}
