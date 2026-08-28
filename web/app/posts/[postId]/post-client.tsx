"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PostDetailScreen } from '@/components/post-detail-screen';
import { clearAuthSession, getPost, loadAuthSession, type ApiPost, type AuthUser } from '@/lib/auth';
import type { Post } from '@/lib/data';

type PostClientProps = {
  postId: string;
};

function getInitials(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}

function mapApiPost(post: ApiPost): Post {
  return {
    id: post.id,
    name: post.author_display_name || post.author_username,
    handle: `@${post.author_username}`,
    initials: getInitials(post.author_display_name || post.author_username),
    tone: 'mint',
    date: new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    text: post.content,
    connectionType: 'following',
    isConnection: true,
    isStarred: false,
    replies: 0,
    reactions: 0,
    quotedPost: post.quoted_post
      ? {
          id: post.quoted_post.id,
          authorUsername: post.quoted_post.author_username,
          content: post.quoted_post.content,
          unavailable: post.quoted_post.unavailable,
        }
      : null,
  };
}

export function PostClient({ postId }: PostClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    setUser(session.user);

    getPost(postId)
      .then((apiPost) => setPost(mapApiPost(apiPost)))
      .catch(() => {
        router.replace('/home');
      });
  }, [postId, router]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user || !post) return null;

  return (
    <AppShell user={user} onLogout={handleLogout} initialScreen="home" showTabs={false} showFloatingBar={false}>
      <PostDetailScreen post={post} />
    </AppShell>
  );
}
