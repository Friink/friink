'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, LoginForm } from '@friink/auth-ui';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit({ identifier, password }: { identifier: string; password: string }) {
    setBusy(true);
    setError('');
    const result = await authClient.signIn.email({ email: identifier, password, callbackURL: '/' });
    setBusy(false);
    if (result.error) setError(result.error.message ?? 'Sorry, that didn’t work.');
    else router.push('/');
  }

  return <AuthShell><LoginForm busy={busy} error={error} onSubmit={submit} onSignup={() => router.push('/signup')} onForgotPassword={() => router.push('/forgot-password')} /></AuthShell>;
}
