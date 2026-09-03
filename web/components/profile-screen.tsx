"use client";

import { useEffect, useRef, useState } from 'react';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import { FeedPost } from '@/components/feed-post';
import { Tabs } from '@/components/tabs';
import type { AuthUser } from '@/lib/auth';
import type { Post } from '@/lib/data';
import { ActionMenu } from '@/components/action-menu';
import { Modal } from '@/components/modal';
import { blockUser, loadAuthSession } from '@/lib/auth';

type ProfileScreenProps = {
  user: AuthUser;
  posts: Post[];
  likedPosts?: Post[];
  likedPostsHasMore?: boolean;
  likedPostsLoading?: boolean;
  onLoadMoreLikedPosts?: () => void;
  profileStats?: { followers: number; following: number } | null;
  profileConnectionsBasePath?: string;
  isOwnProfile?: boolean;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onPostUpdated?: (post: Post) => void;
  onReactionError?: (message: string) => void;
  onEditProfile?: () => void;
  onMessage?: () => void;
  onBlocked?: () => void;
  connectionState?: 'self' | 'none' | 'requested' | 'following';
  connectionActionBusy?: boolean;
  onFollow?: () => void;
  onCancelRequest?: () => void;
  onUnfollow?: () => void;
  initialTab?: ProfileTab;
  onTabChange?: (tab: ProfileTab) => void;
};

export type ProfileTab = 'posts' | 'replies' | 'likes';

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'replies', label: 'Replies' },
  { id: 'likes', label: 'Likes' },
];

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

export function ProfileScreen({
  user,
  posts,
  likedPosts = [],
  likedPostsHasMore = false,
  likedPostsLoading = false,
  onLoadMoreLikedPosts,
  profileStats = null,
  profileConnectionsBasePath,
  isOwnProfile = true,
  onReply,
  onQuote,
  onPostUpdated,
  onReactionError,
  onEditProfile,
  onMessage,
  onBlocked,
  connectionState = isOwnProfile ? 'self' : 'none',
  connectionActionBusy = false,
  onFollow,
  onCancelRequest,
  onUnfollow,
  initialTab = 'posts',
  onTabChange,
}: ProfileScreenProps) {
  const connectionsBasePath = profileConnectionsBasePath ?? `/${encodeURIComponent(user.username)}/connections`;
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const likesLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setActiveTab(initialTab), [initialTab]);
  useEffect(() => {
    if (activeTab !== 'likes' || !likedPostsHasMore || likedPostsLoading || !likesLoadMoreRef.current || !onLoadMoreLikedPosts) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onLoadMoreLikedPosts(); }, { rootMargin: '240px' });
    observer.observe(likesLoadMoreRef.current);
    return () => observer.disconnect();
  }, [activeTab, likedPostsHasMore, likedPostsLoading, onLoadMoreLikedPosts]);
  const profilePosts = posts.filter((post) => post.handle === `@${user.username}`);
  const showLikesTab = isOwnProfile || user.likesVisible;
  const visibleProfileTabs = showLikesTab ? profileTabs : profileTabs.filter((tab) => tab.id !== 'likes');
  const aboutText = user.about?.trim();
  const action = getConnectionAction(connectionState, { onFollow, onCancelRequest, onUnfollow });

  return (
    <PageSurface className="profile-screen">
      <section className="profile-summary" aria-label="Profile summary">
        <div className="profile-intro">
          <ProfileCard
            name={user.name}
            handle={`@${user.username}`}
            tone="mint"
            initials={getInitials(user.name)}
            imageUrl={user.profilePictureUrl}
          />
        </div>

        <p className="profile-bio">
          {aboutText || (isOwnProfile ? 'Add about in settings.' : '')}
        </p>

        <div className="profile-meta-row">
          <div className="profile-stats" aria-label="Profile statistics">
            <a href={`${connectionsBasePath}/following`}>
              <strong>{profileStats?.following ?? '—'}</strong> following
            </a>
            <a href={`${connectionsBasePath}/followers`}>
              <strong>{profileStats?.followers ?? '—'}</strong> followers
            </a>
          </div>

          <div className="profile-actions">
            {isOwnProfile ? (
              <button className="profile-action-button profile-action-edit" type="button" aria-label="Edit profile" onClick={onEditProfile}>
                <i className="fa-regular fa-pen-to-square" aria-hidden="true" />
                <span>Edit</span>
              </button>
            ) : (
              <>
                {action && (
                  <button
                    className="profile-action-button"
                    type="button"
                    onClick={action.onClick}
                    disabled={connectionActionBusy}
                    aria-label={action.ariaLabel}
                  >
                    <i className={action.icon} aria-hidden="true" />
                    <span>{connectionActionBusy ? 'Updating' : action.label}</span>
                  </button>
                )}
                <button className="profile-action-button profile-message-icon" type="button" aria-label="Message user" onClick={onMessage}>
                  <i className="fa-regular fa-paper-plane" aria-hidden="true" />
                </button>
                <button ref={menuButtonRef} className="profile-action-button" type="button" aria-label="More profile options" onClick={() => setMenuOpen((value) => !value)}><i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" /></button>
                <ActionMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} items={[{ label: 'Block user', icon: 'fa-ban', onClick: () => setConfirmBlock(true) }]} />
              </>
            )}
          </div>
        </div>
      </section>

      {confirmBlock && <Modal title="Block user" onClose={() => !blockBusy && setConfirmBlock(false)} actions={<><button className="button-secondary" type="button" onClick={() => setConfirmBlock(false)} disabled={blockBusy}>Cancel</button><button className="button-primary" type="button" disabled={blockBusy} onClick={async () => { const session = loadAuthSession(); if (!session) return; setBlockBusy(true); try { await blockUser(session.accessToken, user.username); onBlocked?.(); } finally { setBlockBusy(false); setConfirmBlock(false); } }}> {blockBusy ? 'Blocking…' : 'Block user'} </button></>}><p>They will not be able to view your profile or message you. Follow relationships will be removed and existing chats will become read-only.</p></Modal>}

      <Tabs
        tabs={visibleProfileTabs}
        activeId={activeTab}
        onChange={(id) => {
          const tab = id as ProfileTab;
          setActiveTab(tab);
          onTabChange?.(tab);
        }}
        ariaLabel="Profile tabs"
        className="section-tabs"
      />

      <div className="profile-feed">
        {activeTab === 'posts' && profilePosts.length > 0 ? (
          profilePosts.map((post) => <FeedPost key={post.id} post={post} onReply={onReply} onQuote={onQuote} onPostUpdated={onPostUpdated} onReactionError={onReactionError} />)
        ) : activeTab === 'likes' && showLikesTab && likedPosts.length > 0 ? (
          likedPosts.map((post) => <FeedPost key={post.id} post={post} onReply={onReply} onQuote={onQuote} onPostUpdated={onPostUpdated} onReactionError={onReactionError} />)
        ) : activeTab === 'likes' && !showLikesTab ? (
          <div className="profile-empty">
            <i className="fa-regular fa-heart" aria-hidden="true" />
            <p>Likes are hidden.</p>
          </div>
        ) : (
          <div className="profile-empty">
            <i className="fa-regular fa-comment" aria-hidden="true" />
            <p>Nothing here yet.</p>
          </div>
        )}
        {activeTab === 'likes' && showLikesTab && likedPostsHasMore && <div ref={likesLoadMoreRef} className="profile-likes-load-more" aria-live="polite">{likedPostsLoading ? 'Loading more likes…' : null}</div>}
      </div>
    </PageSurface>
  );
}

function getConnectionAction(
  state: 'self' | 'none' | 'requested' | 'following',
  handlers: Pick<ProfileScreenProps, 'onFollow' | 'onCancelRequest' | 'onUnfollow'>,
) {
  if (state === 'none') {
    return {
      label: 'Follow',
      ariaLabel: 'Send follow request',
      icon: 'fa-solid fa-user-plus',
      onClick: handlers.onFollow,
    };
  }
  if (state === 'requested') {
    return {
      label: 'Cancel request',
      ariaLabel: 'Cancel follow request',
      icon: 'fa-solid fa-user-clock',
      onClick: handlers.onCancelRequest,
    };
  }
  if (state === 'following') {
    return {
      label: 'Following',
      ariaLabel: 'Unfollow user',
      icon: 'fa-solid fa-user-check',
      onClick: handlers.onUnfollow,
    };
  }
  return null;
}
