"use client";

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Composer } from '@/components/composer';
import { PostDetailScreen } from '@/components/post-detail-screen';
import { clearAuthSession, createPost, getPost, listPostReplies, loadAuthSession, type ApiPost, type AuthUser } from '@/lib/auth';
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
    kind: post.kind ?? 'post',
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
          authorDisplayName: post.quoted_post.author_display_name,
          content: post.quoted_post.content,
          mediaCount: post.quoted_post.media_count,
          unavailable: post.quoted_post.unavailable,
        }
      : null,
  };
}

export function PostClient({ postId }: PostClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [composeContext, setComposeContext] = useState<{ kind: 'reply' | 'quote'; post: Post } | null>(null);

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

    listPostReplies(postId)
      .then((items) => setReplies(items.map(mapApiPost)))
      .catch(() => {
        setReplies([]);
      });
  }, [postId, router]);

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !composeContext) return;

    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    setBusy(true);
    try {
      const created = await createPost(session.accessToken, {
        kind: composeContext.kind,
        content: draft.trim(),
        quotedPostId: composeContext.kind === 'quote' ? composeContext.post.id : null,
        parentPostId: composeContext.kind === 'reply' ? composeContext.post.id : null,
      });
      const mapped = mapApiPost(created);
      if (mapped.kind === 'reply') {
        setReplies((current) => [...current, mapped]);
      } else {
        router.push(`/posts/${mapped.id}`);
      }
      setDraft('');
      setComposeContext(null);
    } finally {
      setBusy(false);
    }
  }

  if (!user || !post) return null;

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      initialScreen="home"
      showTabs={false}
      showFloatingBar={Boolean(composeContext)}
      floatingBarContent={composeContext ? (
        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          disabled={busy}
          multiline
          placeholder={composeContext.kind === 'reply' ? 'Write a reply...' : 'Add your quote...'}
          disabledPlaceholder="Posting..."
          inputLabel="Post"
          sendLabel="Post"
          maxLength={512}
          showCount
          contextLabel={composeContext.kind === 'reply' ? `Replying to ${composeContext.post.name}` : 'Quoting'}
          quotedPreview={composeContext.kind === 'quote' ? {
            name: composeContext.post.name,
            handle: composeContext.post.handle,
            initials: composeContext.post.initials,
            tone: composeContext.post.tone,
            text: composeContext.post.text,
            mediaCount: 0,
          } : null}
        />
      ) : false}
    >
      <PostDetailScreen
        post={post}
        replies={replies}
        onReply={(target) => setComposeContext({ kind: 'reply', post: target })}
        onQuote={(target) => setComposeContext({ kind: 'quote', post: target })}
      />
    </AppShell>
  );
}
