"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { loadAuthSession, refreshAuthSession } from '@/lib/auth';

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
        // A failed refresh is not proof that the user has no session: network,
        // CORS, timeout, and server errors are intentionally ambiguous. On the
        // signed-out login route there is no local session to clear, so render
        // the form for a fresh login instead of leaving the page blank forever.
        setSessionChecked(true);
      });
  }, [router]);

  if (!sessionChecked) return null;

  return <LoginScreen onAuthenticated={() => router.replace('/home')} />;
}
