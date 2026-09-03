"use client";

import { useEffect, useRef, useState } from 'react';
import { ListRow } from '@/components/list-row';
import { Modal } from '@/components/modal';
import { ProfileCard } from '@/components/profile-card';
import { listPostLikes, loadAuthSession, type LikeActor } from '@/lib/auth';

type PostLikesModalProps = {
  postId: string;
  onClose: () => void;
};

export function PostLikesModal({ postId, onClose }: PostLikesModalProps) {
  const [query, setQuery] = useState('');
  const [actors, setActors] = useState<LikeActor[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);

  async function load(reset: boolean) {
    const session = loadAuthSession();
    if (!session || (loading && !reset)) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const page = await listPostLikes(session.accessToken, postId, { query, cursor: reset ? null : cursor });
      if (requestId !== requestRef.current) return;
      setActors((current) => reset ? page.items : [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (error) {
      if (requestId === requestRef.current) setLoadError(error instanceof Error ? error.message : 'Could not load likes.');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActors([]);
      setCursor(null);
      setHasMore(true);
      void load(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, postId]);

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void load(false);
    }, { rootMargin: '160px' });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMore, loading]);

  return (
    <Modal title="Liked by" onClose={onClose} className="post-likes-modal">
      <div className="post-likes-search">
        <input
          className="settings-field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
          aria-label="Search people who liked this post"
        />
      </div>
      {loadError && <p className="post-likes-message" role="status">{loadError}</p>}
      {!loading && !loadError && actors.length === 0 && <p className="post-likes-message">Not found.</p>}
      <div className="post-likes-list">
        {actors.map((actor) => (
          <ListRow
            key={actor.id}
            title={(
              <ProfileCard
                href={`/${encodeURIComponent(actor.username)}`}
                name={actor.displayName}
                handle={`@${actor.username}`}
                tone="mint"
                imageUrl={actor.profilePictureUrl}
              />
            )}
          />
        ))}
      </div>
      {loading && <p className="post-likes-message" role="status">Loading…</p>}
      {hasMore && <div ref={loadMoreRef} className="post-likes-sentinel" aria-hidden="true" />}
    </Modal>
  );
}
