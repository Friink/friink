"use client";

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Composer } from '@/components/composer';
import { PostDetailScreen } from '@/components/post-detail-screen';
import { clearAuthSession, createPost, getPost, listPostReplies, loadAuthSession, type ApiPost, type AuthUser } from '@/lib/auth';
import type { Post } from '@/lib/data';
import { getPostPathForPost } from '@/lib/post-path';

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
    publicId: post.public_id,
    slug: post.slug,
    kind: post.kind,
    name: post.author_display_name || post.author_username,
    handle: `@${post.author_username}`,
    initials: getInitials(post.author_display_name || post.author_username),
    imageUrl: post.profile_picture_url,
    tone: 'mint',
    createdAt: post.created_at,
    text: post.content,
    connectionType: 'following',
    isConnection: true,
    isStarred: post.starred ?? false,
    isLiked: post.liked ?? false,
    replies: post.reply_count,
    quotes: post.quote_count,
    likeCount: post.like_count ?? 0,
    starCount: post.star_count ?? 0,
    reactions: 0,
    quotedPost: post.quoted_post
      ? {
          id: post.quoted_post.id,
          publicId: post.quoted_post.public_id,
          slug: post.quoted_post.slug,
          authorUsername: post.quoted_post.author_username,
          authorDisplayName: post.quoted_post.author_display_name,
          imageUrl: post.quoted_post.profile_picture_url,
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
  const [reactionError, setReactionError] = useState('');
  const [postUnavailable, setPostUnavailable] = useState(false);

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
        setPostUnavailable(true);
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
        router.push(getPostPathForPost(mapped));
      }
      setDraft('');
      setComposeContext(null);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  if (!post) {
    return postUnavailable ? (
      <AppShell user={user} onLogout={handleLogout} initialScreen="home" showTabs={false} showFloatingBar={false}>
        <section className="post-unavailable" aria-live="polite">
          <h1>Post unavailable</h1>
          <p>This post may have been deleted or is no longer visible to you.</p>
        </section>
      </AppShell>
    ) : null;
  }

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
          draftStorageKey={`friink-draft:${user.id}:post:${postId}:${composeContext.kind}`}
          showCount
          enableMentions
          contextLabel={composeContext.kind === 'reply' ? `Replying to ${composeContext.post.name}` : `Quoting ${composeContext.post.name}`}
          referencedPreview={{
            name: composeContext.post.name,
            handle: composeContext.post.handle,
            initials: composeContext.post.initials,
            tone: composeContext.post.tone,
            text: composeContext.post.text,
            mediaCount: 0,
          }}
        />
      ) : false}
    >
      <PostDetailScreen
        post={post}
        replies={replies}
        onReply={(target) => setComposeContext({ kind: 'reply', post: target })}
        onQuote={(target) => setComposeContext({ kind: 'quote', post: target })}
        onPostUpdated={(updated) => { if (updated.id === post.id) setPost(updated); setReplies((current) => current.map((item) => item.id === updated.id ? updated : item)); }}
        onReactionError={setReactionError}
        reactionError={reactionError}
      />
    </AppShell>
  );
}
