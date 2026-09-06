"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { loadAuthSession } from '@/lib/auth';

export function LoginClient() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();

    if (session) {
      router.replace('/home');
      return;
    }

    setSessionChecked(true);
  }, [router]);

  if (!sessionChecked) return null;

  return <LoginScreen onAuthenticated={() => router.replace('/home')} />;
}
