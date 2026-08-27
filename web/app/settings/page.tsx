"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, getCurrentUser, loadAuthSession, saveAuthSession, type AuthUser } from '@/lib/auth';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    getCurrentUser(session.accessToken)
      .then((currentUser) => {
        saveAuthSession({ ...session, user: currentUser });
        setUser(currentUser);
      })
      .catch(() => {
        clearAuthSession();
        router.replace('/login');
      });
  }, [router]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  return <AppShell user={user} onLogout={handleLogout} initialScreen="settings" onUserChange={setUser} />;
}
