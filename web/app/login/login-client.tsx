"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/login-screen';
import { consumeLoginLink, getMostRecentRememberedAccount, hasSessionForEntry, loadAuthSession, restoreAuthSessionForEntry, saveAuthSession } from '@/lib/auth';

const SECURITY_REVOCATION_MESSAGE = 'For your security, your session ended. Please sign in again.';

export function LoginClient() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(true);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [initialIdentifier, setInitialIdentifier] = useState<string | undefined>();

  useEffect(() => {
    const session = loadAuthSession();
    const loginToken = new URLSearchParams(window.location.search).get('login_token');

    if (window.location.search.includes('reason=security-revocation')) {
      setInitialMessage(SECURITY_REVOCATION_MESSAGE);
    }
    const rememberedAccount = new URLSearchParams(window.location.search).get('account') || getMostRecentRememberedAccount()?.username;
    if (rememberedAccount) setInitialIdentifier(rememberedAccount);

    if (session) {
      router.replace('/home');
      return;
    }

    if (loginToken) {
      window.history.replaceState({}, '', '/login');
      consumeLoginLink(loginToken)
        .then((loginSession) => {
          saveAuthSession(loginSession);
          router.replace('/home');
        })
        .catch((error) => {
          setInitialMessage(error instanceof Error ? error.message : 'This sign-in link is invalid or expired.');
          setSessionChecked(true);
        });
      return;
    }

    hasSessionForEntry()
      .then((available) => available ? restoreAuthSessionForEntry() : null)
      .then((restored) => {
        if (restored || loadAuthSession()) router.replace('/home');
        else setSessionChecked(true);
      })
      .catch((error) => {
        if (loadAuthSession()) {
          router.replace('/home');
          return;
        }
        if (error instanceof Error && error.message) setInitialMessage(error.message);
        setSessionChecked(true);
      });
  }, [router]);

  if (!sessionChecked) return null;

  return <LoginScreen onAuthenticated={() => router.replace('/home')} initialMessage={initialMessage} initialIdentifier={initialIdentifier} />;
}
