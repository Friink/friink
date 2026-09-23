"use client";

import { useEffect, useRef, useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import { ActionMenu } from '@/components/action-menu';
import { ListRow } from '@/components/list-row';
import { ProfileCard } from '@/components/profile-card';
import { PageSurface } from '@/components/page-surface';
import { blockUser, cancelFollowRequest, getConnectionStatus, listSavedPosts, listSavedProfiles, loadAuthSession, removeConnection, removeSavedProfile, sendFollowRequest, type ApiPost, type ApiSavedProfile } from '@/lib/auth';
import type { Post } from '@/lib/data';

type SavedScreenProps = {
  section?: 'posts' | 'profiles';
  posts: Post[];
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onPostUpdated?: (post: Post) => void;
  onPostDeleted?: (post: Post) => void;
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

function SavedProfileRow({ profile, onRemoved, onError }: { profile: ApiSavedProfile; onRemoved: (id: string) => void; onError?: (message: string) => void }) {
  const [connectionState, setConnectionState] = useState<'none' | 'requested' | 'following'>('none');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileName = profile.available ? (profile.display_name || profile.username || 'Profile') : 'Profile unavailable';
  const profileHandle = profile.available ? `@${profile.username}` : 'This profile is no longer available.';

  useEffect(() => {
    if (!profile.available || !profile.username) return;
    const session = loadAuthSession();
    if (!session) return;
    getConnectionStatus(session.accessToken, profile.username)
      .then((status) => {
        setConnectionState(status.state === 'following' ? 'following' : status.state === 'requested' ? 'requested' : 'none');
        setRequestId(status.request?.id ?? null);
      })
      .catch(() => setConnectionState('none'));
  }, [profile.available, profile.username]);

  async function handleConnection() {
    if (!profile.username || busy) return;
    const session = loadAuthSession();
    if (!session) return;
    setBusy(true);
    try {
      if (connectionState === 'none') {
        const request = await sendFollowRequest(session.accessToken, profile.username);
        setConnectionState(request.status === 'accepted' ? 'following' : 'requested');
        setRequestId(request.id);
      } else if (requestId) {
        if (connectionState === 'requested') await cancelFollowRequest(session.accessToken, requestId);
        else await removeConnection(session.accessToken, requestId);
        setConnectionState('none');
        setRequestId(null);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not update the connection.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSaved() {
    const session = loadAuthSession();
    if (!session) return;
    try {
      await removeSavedProfile(session.accessToken, profile.id);
      onRemoved(profile.id);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not remove saved profile.');
    }
  }

  async function handleBlock() {
    if (!profile.username) return;
    const session = loadAuthSession();
    if (!session || !window.confirm(`Block @${profile.username}?`)) return;
    try {
      await blockUser(session.accessToken, profile.username);
      onRemoved(profile.id);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not block user.');
    }
  }

  return (
    <ListRow
      avatar={profile.available ? <ProfileCard href={`/${encodeURIComponent(profile.username!)}/posts`} name={profileName} handle={`@${profile.username}`} initials={profileName.slice(0, 2).toUpperCase()} tone="mint" imageUrl={profile.profile_picture_url} showProfessionalBadge={profile.show_professional_badge} /> : <ProfileCard name={profileName} handle="" initials="?" tone="sage" />}
      title={<span className="sr-only">{profileName}</span>}
      subtitle={<span className="sr-only">{profileHandle}</span>}
      className="saved-row"
      trailing={profile.available ? (
        <span className="saved-profile-actions">
          <button
            className="icon-button saved-profile-follow"
            type="button"
            disabled={busy}
            aria-label={connectionState === 'following' ? `Unfollow ${profileName}` : connectionState === 'requested' ? `Cancel follow request to ${profileName}` : `Follow ${profileName}`}
            title={connectionState === 'following' ? 'Unfollow' : connectionState === 'requested' ? 'Cancel follow request' : 'Follow'}
            aria-pressed={connectionState === 'following'}
            onClick={() => { void handleConnection(); }}
          >
            <i className={`fa-solid ${connectionState === 'following' ? 'fa-user-check' : connectionState === 'requested' ? 'fa-user-clock' : 'fa-user-plus'}`} aria-hidden="true" />
          </button>
          <button ref={menuButtonRef} className="icon-button" type="button" aria-label={`More actions for ${profileName}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
          </button>
          <ActionMenu
            open={menuOpen}
            anchorRef={menuButtonRef}
            items={[
              { label: 'Remove from saved', icon: 'fa-star', onClick: () => { void handleRemoveSaved(); } },
              { label: 'Block user', icon: 'fa-ban', dividerBefore: true, onClick: () => { void handleBlock(); } },
            ]}
            onClose={() => setMenuOpen(false)}
          />
        </span>
      ) : (
        <button className="icon-button" type="button" aria-label="Remove saved profile" title="Remove saved profile" onClick={() => { void handleRemoveSaved(); }}><span className="saved-profile-remove-icon" aria-hidden="true"><i className="fa-solid fa-star" /><i className="fa-solid fa-slash saved-profile-remove-slash" /></span></button>
      )}
    />
  );
}

export function SavedScreen({ section = 'posts', posts, onReply, onQuote, onPostUpdated, onPostDeleted, onReactionError }: SavedScreenProps) {
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
              <FeedPost key={post.id} post={post} onReply={onReply} onQuote={onQuote} onPostUpdated={handleUpdated} onPostDeleted={(deleted) => { setSavedPosts((current) => current.filter((item) => item.id !== deleted.id)); onPostDeleted?.(deleted); }} onReactionError={onReactionError} />
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
            {savedProfiles.length > 0 ? savedProfiles.map((profile) => <SavedProfileRow key={profile.id} profile={profile} onRemoved={(id) => setSavedProfiles((current) => current.filter((item) => item.id !== id))} onError={onReactionError} />) : !profilesLoading ? (
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
