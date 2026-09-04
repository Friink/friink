"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { clearAuthSession, getPublicUser, listFollowers, listFollowing, listLikedPosts, loadAuthSession, type ApiPost, type AuthUser } from '@/lib/auth';
import type { Post } from '@/lib/data';

type ProfileClientProps = {
  username: string;
  initialTab?: 'posts' | 'replies' | 'likes';
};

function getInitials(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'FR';
}

function mapApiPost(post: ApiPost): Post {
  return {
    id: post.id, publicId: post.public_id, slug: post.slug, kind: post.kind,
    name: post.author_display_name || post.author_username, handle: `@${post.author_username}`,
    initials: getInitials(post.author_display_name || post.author_username), imageUrl: post.profile_picture_url,
    tone: 'mint', createdAt: post.created_at, text: post.content, connectionType: 'following', isConnection: true,
    isStarred: post.starred ?? false, isLiked: post.liked ?? false, replies: post.reply_count, quotes: post.quote_count,
    likeCount: post.like_count ?? 0, starCount: post.star_count ?? 0, reactions: 0, media: post.media.map((item) => item.url),
    quotedPost: post.quoted_post ? {
      id: post.quoted_post.id,
      publicId: post.quoted_post.public_id,
      slug: post.quoted_post.slug,
      authorUsername: post.quoted_post.author_username,
      authorDisplayName: post.quoted_post.author_display_name,
      imageUrl: post.quoted_post.profile_picture_url,
      content: post.quoted_post.content,
      mediaCount: post.quoted_post.media_count,
      media: post.quoted_post.media.map((item) => item.url),
      unavailable: post.quoted_post.unavailable,
    } : null,
  };
}

export function ProfileClient({ username, initialTab = 'posts' }: ProfileClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);
  const [profileStats, setProfileStats] = useState<{ followers: number; following: number } | null>(null);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [likedCursor, setLikedCursor] = useState<string | null>(null);
  const [likedHasMore, setLikedHasMore] = useState(false);
  const [likedLoading, setLikedLoading] = useState(false);
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
    const session = loadAuthSession();
    if (!session) return;

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
          likesVisible: publicUser.likesVisible,
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

  async function loadLikedPosts(reset = false) {
    if (!user || likedLoading || (!reset && !likedCursor)) return;
    const session = loadAuthSession();
    if (!session) return;
    setLikedLoading(true);
    try {
      const page = await listLikedPosts(session.accessToken, username || user.username, reset ? null : likedCursor);
      const incoming = page.items.map(mapApiPost);
      setLikedPosts((current) => reset ? incoming : [...current, ...incoming.filter((item) => !current.some((old) => old.id === item.id))]);
      setLikedCursor(page.next_cursor);
      setLikedHasMore(page.has_more);
    } catch {
      if (reset) {
        setLikedPosts([]);
        setLikedCursor(null);
        setLikedHasMore(false);
      }
    } finally {
      setLikedLoading(false);
    }
  }

  useEffect(() => {
    if (initialTab !== 'likes') return;
    setLikedPosts([]);
    setLikedCursor(null);
    setLikedHasMore(false);
    void loadLikedPosts(true);
  }, [user, username, initialTab]);

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
      profileLikedPosts={likedPosts}
      profileLikedPostsHasMore={likedHasMore}
      profileLikedPostsLoading={likedLoading}
      onLoadMoreProfileLikedPosts={() => { void loadLikedPosts(); }}
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
