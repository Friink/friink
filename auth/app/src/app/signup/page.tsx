'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, SignupForm, type SignupSubmit } from '@friink/auth-ui';
import { authClient } from '@/lib/auth-client';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(value: SignupSubmit) {
    setBusy(true);
    setError('');
    const result = await authClient.signUp.email({ email: value.email, password: value.password, name: value.name, callbackURL: '/' });
    setBusy(false);
    if (result.error) setError(result.error.message ?? 'Sorry, that didn’t work.');
    else router.push('/');
  }

  return <AuthShell><SignupForm busy={busy} error={error} onSubmit={submit} onBack={() => router.back()} onLogin={() => router.push('/login')} /></AuthShell>;
}
