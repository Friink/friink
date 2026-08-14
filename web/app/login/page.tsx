'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { loadAuthSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const session = loadAuthSession();
    if (session) {
      router.replace('/home');
    }
  }, [router]);

  return <LoginScreen onAuthenticated={() => router.replace('/home')} />;
}
