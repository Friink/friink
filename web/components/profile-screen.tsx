'use client';

import { useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import { currentUser, type Post } from '@/lib/data';

type ProfileScreenProps = {
  posts: Post[];
};

type ProfileTab = 'posts' | 'replies';

const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'replies', label: 'Replies' },
];

export function ProfileScreen({ posts }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const profilePosts = posts.filter((post) => post.name === currentUser.name);

  return (
    <section className="profile-screen">
      <div className="profile-intro">
        <span className={`user-avatar avatar-${currentUser.tone} profile-large-avatar`}>{currentUser.initials}</span>
        <div className="profile-details">
          <h2>{currentUser.name}</h2>
          <p>{currentUser.handle}</p>
          <p className="profile-bio">Making room for good conversations, quiet mornings, and people who feel like home.</p>
        </div>
      </div>

      <div className="profile-stats" aria-label="Profile statistics">
        <span><strong>18</strong> following</span>
        <span><strong>34</strong> followers</span>
      </div>

      <div className="profile-edit-row">
        <button className="profile-edit-button" type="button">Edit</button>
      </div>

      <div className="profile-tabs" role="tablist" aria-label="Profile content">
        {profileTabs.map((tab) => (
          <button
            className={`profile-tab${activeTab === tab.id ? ' active' : ''}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
