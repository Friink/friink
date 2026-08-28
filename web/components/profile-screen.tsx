"use client";

import { useState } from 'react';
import { ProfileCard } from '@/components/profile-card';
import { FeedPost } from '@/components/feed-post';
import { Tabs } from '@/components/tabs';
import type { AuthUser } from '@/lib/auth';
import type { Post } from '@/lib/data';

type ProfileScreenProps = {
  user: AuthUser;
  posts: Post[];
  isOwnProfile?: boolean;
  onQuote?: (post: Post) => void;
  onEditProfile?: () => void;
  connectionState?: 'self' | 'none' | 'requested' | 'following';
  connectionActionBusy?: boolean;
  onFollow?: () => void;
  onCancelRequest?: () => void;
  onUnfollow?: () => void;
};

type ProfileTab = 'posts' | 'replies';

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'replies', label: 'Replies' },
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
  isOwnProfile = true,
  onQuote,
  onEditProfile,
  connectionState = isOwnProfile ? 'self' : 'none',
  connectionActionBusy = false,
  onFollow,
  onCancelRequest,
  onUnfollow,
}: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const profilePosts = posts.filter((post) => post.handle === `@${user.username}`);
  const action = getConnectionAction(connectionState, { onFollow, onCancelRequest, onUnfollow });

  return (
    <section className="profile-screen">
      <div className="profile-intro">
        <ProfileCard
          name={user.name}
          handle={`@${user.username}`}
          tone="mint"
          initials={getInitials(user.name)}
        />
      </div>

      <p className="profile-bio">
        {user.about || (isOwnProfile ? 'Your signed-in account is now driving this profile view.' : 'This profile has not added an about yet.')}
      </p>

      <div className="profile-stats" aria-label="Profile statistics">
        <span><strong>0</strong> following</span>
        <span><strong>0</strong> followers</span>
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
            <button className="profile-action-button profile-message-icon" type="button" aria-label="Message user">
              <i className="fa-regular fa-paper-plane" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <Tabs
        tabs={profileTabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as ProfileTab)}
        ariaLabel="Profile tabs"
        className="section-tabs"
      />

      <div className="profile-feed">
        {activeTab === 'posts' && profilePosts.length > 0 ? (
          profilePosts.map((post) => <FeedPost key={post.id} post={post} onQuote={onQuote} />)
        ) : (
          <div className="profile-empty">
            <i className="fa-regular fa-comment" aria-hidden="true" />
            <p>Nothing here yet.</p>
          </div>
        )}
      </div>
    </section>
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
