"use client";

import { useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import { Tabs } from '@/components/tabs';
import type { AuthUser } from '@/lib/auth';
import type { Post } from '@/lib/data';

type ProfileScreenProps = {
  user: AuthUser;
  posts: Post[];
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

export function ProfileScreen({ user, posts }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const profilePosts = posts.filter((post) => post.handle === `@${user.username}`);

  return (
    <section className="profile-screen">
      <div className="profile-intro">
        <span className="user-avatar avatar-mint profile-large-avatar">{getInitials(user.name)}</span>
        <div className="profile-details">
          <h2>{user.name}</h2>
          <p>@{user.username}</p>
          <p className="profile-bio">Your signed-in account is now driving this profile view.</p>
        </div>
      </div>

      <div className="profile-stats" aria-label="Profile statistics">
        <span><strong>0</strong> following</span>
        <span><strong>0</strong> followers</span>
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
          profilePosts.map((post) => <FeedPost key={post.id} post={post} />)
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
