"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { isTerminalRefreshFailure, loadAuthSession, refreshAuthSession } from '@/lib/auth';

export function LoginClient() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();

    if (session) {
      router.replace('/home');
      return;
    }

    refreshAuthSession()
      .then(() => router.replace('/home'))
      .catch((error) => {
        if (isTerminalRefreshFailure(error)) setSessionChecked(true);
      });
  }, [router]);

  if (!sessionChecked) return null;

  return <LoginScreen onAuthenticated={() => router.replace('/home')} />;
}
