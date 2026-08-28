"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, loadAuthSession, type AuthUser } from '@/lib/auth';
import { getDisplayNameForUsername } from '@/lib/profile-display';

type ProfileClientProps = {
  username: string;
};

export function ProfileClient({ username }: ProfileClientProps) {
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
    router.replace('/');
  }

  if (!user) return null;

  const profileHandle = username || 'alexmorgan';
  const isOwnProfile = profileHandle.toLowerCase() === user.username.toLowerCase();
  const profileUser: AuthUser = {
    ...user,
    id: `dummy-${profileHandle}`,
    name: getDisplayNameForUsername(profileHandle),
    username: profileHandle,
    email: `${profileHandle}@friink.local`,
    about: 'This profile has not added an about yet.',
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
