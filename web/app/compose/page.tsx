"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, loadAuthSession, type AuthUser } from '@/lib/auth';

export default function ComposePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setUser(session.user);
  }, [router]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/login');
  }

  if (!user) return null;

  return <AppShell user={user} onLogout={handleLogout} initialScreen="post" />;
}
