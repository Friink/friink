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
    const result = identifier.includes('@')
      ? await authClient.signIn.email({ email: identifier, password, callbackURL: destination })
      : await authClient.signIn.username({ username: identifier, password, callbackURL: destination });
    setBusy(false);
    if (result.error) setError(result.error.message ?? 'Sorry, that didn’t work.');
    else router.push(destination);
  }

  return <AuthShell><LoginForm busy={busy} error={error} onSubmit={submit} onBack={() => router.push('/')} onSignup={() => router.push('/signup')} onForgotPassword={() => router.push('/forgot-password')} /></AuthShell>;
}
