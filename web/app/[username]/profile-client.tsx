"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, getPublicUser, listFollowers, listFollowing, loadAuthSession, type AuthUser } from '@/lib/auth';

type ProfileClientProps = {
  username: string;
  initialTab?: 'posts' | 'replies';
};

export function ProfileClient({ username, initialTab = 'posts' }: ProfileClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);
  const [profileStats, setProfileStats] = useState<{ followers: number; following: number } | null>(null);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

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

    let active = true;
    const profileHandle = username || user.username;
    const isOwnProfile = profileHandle.toLowerCase() === user.username.toLowerCase();

    if (isOwnProfile) {
      if (active) {
        setProfileUser(null);
        setProfileStatus('ready');
      }
      return;
    }

    setProfileStatus('loading');
    getPublicUser(profileHandle, session.accessToken)
      .then((publicUser) => {
        if (!active) return;
        setProfileUser({
          ...user,
          id: publicUser.id,
          name: publicUser.name,
          username: publicUser.username,
          about: publicUser.about,
          isPrivate: publicUser.isPrivate,
          profilePictureUrl: publicUser.profilePictureUrl,
          profilePictureUpdatedAt: publicUser.profilePictureUpdatedAt,
          email: `${publicUser.username}@friink.local`,
        });
        setProfileStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setProfileUser(null);
        setProfileStatus('unavailable');
      });

    return () => {
      active = false;
    };
  }, [user, username]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const profileHandle = username || user.username;
    setProfileStats(null);

    Promise.all([listFollowers(profileHandle), listFollowing(profileHandle)])
      .then(([followers, following]) => {
        if (!active) return;
        setProfileStats({ followers: followers.count, following: following.count });
      })
      .catch(() => {
        if (active) setProfileStats(null);
      });

    return () => {
      active = false;
    };
  }, [user, username]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  const profileHandle = username || user.username;
  const isOwnProfile = profileHandle.toLowerCase() === user.username.toLowerCase();
  const resolvedProfile = isOwnProfile
    ? profileStatus === 'ready'
    : profileStatus === 'ready' && profileUser?.username.toLowerCase() === profileHandle.toLowerCase();
  const profileUnavailable = !resolvedProfile && profileStatus === 'unavailable';
  const profileConnectionsBasePath = `/${encodeURIComponent(isOwnProfile ? user.username : profileHandle)}/connections`;

  return (
    <AppShell
      user={user}
      profileUser={isOwnProfile ? undefined : (profileUser ?? undefined)}
      profileStats={profileStats}
      profileConnectionsBasePath={profileConnectionsBasePath}
      onLogout={handleLogout}
      initialScreen="profile"
      profileTab={initialTab}
      onProfileTabChange={(tab) => router.push(`/${encodeURIComponent(profileHandle)}/${tab}`)}
    >
      {resolvedProfile ? undefined : (
        <section className="profile-unavailable" aria-live="polite">
          <p>{profileUnavailable ? 'Profile unavailable.' : 'Loading profile...'}</p>
        </section>
      )}
    </AppShell>
  );
}
