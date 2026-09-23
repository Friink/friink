"use client";

import { useEffect, useRef, useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import { ListRow } from '@/components/list-row';
import { ProfileCard } from '@/components/profile-card';
import { PageSurface } from '@/components/page-surface';
import { listSavedPosts, listSavedProfiles, loadAuthSession, removeSavedProfile, type ApiPost, type ApiSavedProfile } from '@/lib/auth';
import type { Post } from '@/lib/data';

type SavedScreenProps = {
  section?: 'posts' | 'profiles';
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
    isSaved: post.saved ?? true, isLiked: post.liked ?? false, replies: post.reply_count, quotes: post.quote_count,
    likeCount: post.like_count ?? 0, savedCount: post.saved_count ?? 0, reactions: 0, media: post.media.map((item) => item.url),
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

export function SavedScreen({ section = 'posts', posts, onReply, onQuote, onPostUpdated, onReactionError }: SavedScreenProps) {
  const [savedPosts, setSavedPosts] = useState<Post[]>(posts.filter((post) => post.isSaved));
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savedProfiles, setSavedProfiles] = useState<ApiSavedProfile[]>([]);
  const [profilesCursor, setProfilesCursor] = useState<string | null>(null);
  const [profilesHasMore, setProfilesHasMore] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const profilesLoadMoreRef = useRef<HTMLDivElement | null>(null);

  async function load(reset = false) {
    if (section !== 'posts') return;
    const session = loadAuthSession();
    if (!session) return;
    setLoading(true);
    try {
      const page = await listSavedPosts(session.accessToken, reset ? null : cursor);
      const incoming = page.items.map(mapApiPost);
      setSavedPosts((current) => reset ? incoming : [...current, ...incoming.filter((item) => !current.some((old) => old.id === item.id))]);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch {
      if (reset) setSavedPosts(posts.filter((post) => post.isSaved));
    } finally {
      setLoading(false);
    }
  }

  async function loadProfiles(reset = false) {
    if (section !== 'profiles' || profilesLoading || (!reset && !profilesCursor)) return;
    const session = loadAuthSession();
    if (!session) return;
    setProfilesLoading(true);
    try {
      const page = await listSavedProfiles(session.accessToken, reset ? null : profilesCursor);
      setSavedProfiles((current) => reset ? page.items : [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
      setProfilesCursor(page.next_cursor);
      setProfilesHasMore(page.has_more);
    } catch {
      if (reset) {
        setSavedProfiles([]);
        setProfilesCursor(null);
        setProfilesHasMore(false);
      }
    } finally {
      setProfilesLoading(false);
    }
  }

  useEffect(() => { void load(true); }, [section]);
  useEffect(() => { void loadProfiles(true); }, [section]);

  useEffect(() => {
    if (!hasMore || !cursor || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: '240px' });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMore, loading]);

  useEffect(() => {
    if (section !== 'profiles' || !profilesHasMore || !profilesCursor || !profilesLoadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadProfiles(); }, { rootMargin: '240px' });
    observer.observe(profilesLoadMoreRef.current);
    return () => observer.disconnect();
  }, [section, profilesCursor, profilesHasMore, profilesLoading]);

  function handleUpdated(post: Post) {
    setSavedPosts((current) => post.isSaved ? current.map((item) => item.id === post.id ? post : item) : current.filter((item) => item.id !== post.id));
    onPostUpdated?.(post);
  }

  return (
    <PageSurface className="saved-feed" variant="list">
      {section === 'posts' ? (
        <>
          <div className="saved-list">
            {savedPosts.length > 0 ? savedPosts.map((post) => (
              <FeedPost key={post.id} post={post} onReply={onReply} onQuote={onQuote} onPostUpdated={handleUpdated} onReactionError={onReactionError} />
            )) : !loading ? (
              <div className="connections-empty saved-empty">
                <i className="fa-solid fa-star" aria-hidden="true" />
                <p>No saved posts yet.</p>
                <span>Save a post to find it here.</span>
              </div>
            ) : null}
          </div>
          {loading && <div className="home-feed-message">Loading saved posts...</div>}
          {hasMore && <div ref={loadMoreRef} className="saved-load-more" aria-hidden="true" />}
        </>
      ) : (
        <>
          <div className="saved-list">
            {savedProfiles.length > 0 ? savedProfiles.map((profile) => (
              <ListRow
                key={profile.id}
                avatar={profile.available ? <ProfileCard href={`/${encodeURIComponent(profile.username!)}/posts`} name={profile.display_name || profile.username || 'Profile'} handle={`@${profile.username}`} initials={(profile.display_name || profile.username || 'FR').slice(0, 2).toUpperCase()} tone="mint" imageUrl={profile.profile_picture_url} showProfessionalBadge={profile.show_professional_badge} /> : <ProfileCard name="Profile unavailable" handle="" initials="?" tone="sage" />}
                title={profile.available ? (profile.display_name || profile.username || 'Profile') : 'Profile unavailable'}
                subtitle={profile.available ? `@${profile.username}` : 'This profile is no longer available.'}
                trailing={<button className="icon-button" type="button" aria-label="Remove saved profile" title="Remove saved profile" onClick={async () => {
                  const session = loadAuthSession();
                  if (!session) return;
                  await removeSavedProfile(session.accessToken, profile.id);
                  setSavedProfiles((current) => current.filter((item) => item.id !== profile.id));
                }}><i className="fa-solid fa-bookmark-slash" aria-hidden="true" /></button>}
              />
            )) : !profilesLoading ? (
              <div className="connections-empty saved-empty">
                <i className="fa-solid fa-bookmark" aria-hidden="true" />
                <p>No saved profiles yet.</p>
                <span>Save a profile from its action menu to find it here.</span>
              </div>
            ) : null}
          </div>
          {profilesLoading && <div className="home-feed-message">Loading saved profiles...</div>}
          {profilesHasMore && <div ref={profilesLoadMoreRef} className="saved-load-more" aria-hidden="true" />}
        </>
      )}
    </PageSurface>
  );
}
