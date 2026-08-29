"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, getPublicUser, loadAuthSession, type AuthUser } from '@/lib/auth';

type ProfileClientProps = {
  username: string;
};

export function ProfileClient({ username }: ProfileClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    setUser(session.user);
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const profileHandle = username || user.username;
    const isOwnProfile = profileHandle.toLowerCase() === user.username.toLowerCase();

    if (isOwnProfile) {
      setProfileUser(null);
      return;
    }

    getPublicUser(profileHandle)
      .then((publicUser) => {
        setProfileUser({
          ...user,
          id: publicUser.id,
          name: publicUser.name,
          username: publicUser.username,
          about: publicUser.about,
          isPrivate: publicUser.isPrivate,
          email: `${publicUser.username}@friink.local`,
        });
      })
      .catch(() => {
        setProfileUser({
          ...user,
          id: `missing-${profileHandle}`,
          name: `@${profileHandle}`,
          username: profileHandle,
          about: 'This profile has not added an about yet.',
          isPrivate: false,
          email: `${profileHandle}@friink.local`,
        });
      });
  }, [user, username]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  const profileHandle = username || user.username;
  const isOwnProfile = profileHandle.toLowerCase() === user.username.toLowerCase();

  return (
    <AppShell
      user={user}
      profileUser={isOwnProfile ? undefined : (profileUser ?? undefined)}
      onLogout={handleLogout}
      initialScreen="profile"
    />
  );
}
