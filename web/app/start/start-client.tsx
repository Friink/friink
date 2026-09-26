"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { hasSessionForEntry, loadAuthSession, restoreAuthSessionForEntry } from '@/lib/auth';

export function StartClient() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PROGRESSIVE_LOGIN_ENABLED !== 'true') {
      router.replace('/login');
      return;
    }

    if (loadAuthSession()) {
      router.replace('/home');
      return;
    }

    hasSessionForEntry()
      .then((available) => available ? restoreAuthSessionForEntry() : null)
      .then((session) => session ? router.replace('/home') : setSessionChecked(true))
      .catch(() => setSessionChecked(true));
  }, [router]);

  if (!sessionChecked) return null;
  return <LoginScreen progressive onAuthenticated={() => router.replace('/home')} />;
}
