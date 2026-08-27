"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, loadAuthSession, type AuthUser } from '@/lib/auth';

export default function UserProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileHandle, setProfileHandle] = useState('alexmorgan');

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    setUser(session.user);
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = window.location.pathname.split('/').filter(Boolean)[0];
    setProfileHandle(slug || 'alexmorgan');
  }, []);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  const isOwnProfile = profileHandle.toLowerCase() === user.username.toLowerCase();

  const profileUser: AuthUser = {
    ...user,
    id: `dummy-${profileHandle}`,
    name: profileHandle
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Friink User',
    username: profileHandle,
    email: `${profileHandle}@friink.local`,
  };

  return (
    <AppShell
      user={user}
      profileUser={isOwnProfile ? undefined : profileUser}
      onLogout={handleLogout}
      initialScreen="profile"
    />
  );
}
