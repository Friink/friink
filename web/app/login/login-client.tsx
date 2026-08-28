"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { loadAuthSession } from '@/lib/auth';

export function LoginClient() {
  const router = useRouter();

  useEffect(() => {
    const session = loadAuthSession();
    const isDemoSession = session?.user?.email === 'demo@friink.local';

    if (session && !isDemoSession) {
      router.replace('/home');
    }
  }, [router]);

  return <LoginScreen onAuthenticated={() => router.replace('/home')} />;
}
