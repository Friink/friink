"use client";

import { useEffect, useRef, useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import { PageSurface } from '@/components/page-surface';
import { Tabs } from '@/components/tabs';
import { listStarredPosts, loadAuthSession, type ApiPost } from '@/lib/auth';
import type { Post } from '@/lib/data';

type StarredScreenProps = {
  posts: Post[];
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onPostUpdated?: (post: Post) => void;
  onReactionError?: (message: string) => void;
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
    isStarred: post.starred ?? true, isLiked: post.liked ?? false, replies: post.reply_count, quotes: post.quote_count,
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

export function StarredScreen({ posts, onReply, onQuote, onPostUpdated, onReactionError }: StarredScreenProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [starredPosts, setStarredPosts] = useState<Post[]>(posts.filter((post) => post.isStarred));
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  async function load(reset = false) {
    const session = loadAuthSession();
    if (!session) return;
    setLoading(true);
    try {
      const page = await listStarredPosts(session.accessToken, reset ? null : cursor);
      const incoming = page.items.map(mapApiPost);
      setStarredPosts((current) => reset ? incoming : [...current, ...incoming.filter((item) => !current.some((old) => old.id === item.id))]);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch {
      if (reset) setStarredPosts(posts.filter((post) => post.isStarred));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(true); }, []);

  useEffect(() => {
    if (!hasMore || !cursor || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: '240px' });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMore, loading]);

  function handleUpdated(post: Post) {
    setStarredPosts((current) => post.isStarred ? current.map((item) => item.id === post.id ? post : item) : current.filter((item) => item.id !== post.id));
    onPostUpdated?.(post);
  }

  return (
    <PageSurface className="starred-feed" variant="list">
      <Tabs
        tabs={[{ id: 'all', label: 'All' }, { id: 'followers', label: 'Followers' }, { id: 'following', label: 'Following' }]}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Starred tabs"
      />
      <div className="starred-list">
        {starredPosts.length > 0 ? starredPosts.map((post) => (
          <FeedPost key={post.id} post={post} onReply={onReply} onQuote={onQuote} onPostUpdated={handleUpdated} onReactionError={onReactionError} />
        )) : !loading ? (
          <div className="connections-empty starred-empty">
            <i className="fa-solid fa-star" aria-hidden="true" />
            <p>No starred posts yet.</p>
            <span>Star a post to find it here.</span>
          </div>
        ) : null}
      </div>
      {loading && <div className="home-feed-message">Loading starred posts...</div>}
      {hasMore && <div ref={loadMoreRef} className="starred-load-more" aria-hidden="true" />}
    </PageSurface>
  );
}
