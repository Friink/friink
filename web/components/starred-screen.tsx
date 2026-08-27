import { FeedPost } from '@/components/feed-post';
import { Tabs } from '@/components/tabs';
import { useState } from 'react';
import type { Post } from '@/lib/data';

type StarredScreenProps = {
  posts: Post[];
  onQuote?: (post: Post) => void;
};

export function StarredScreen({ posts, onQuote }: StarredScreenProps) {
  const [activeTab, setActiveTab] = useState('all');

  const starredPosts = posts.filter((post) => post.isStarred);

  return (
    <div className="home-feed starred-feed">
      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'followers', label: 'Followers' },
          { id: 'following', label: 'Following' },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id)}
        ariaLabel="Starred tabs"
      />
      {starredPosts.length > 0 ? (
        starredPosts.map((post) => <FeedPost key={post.id} post={post} highlightedStar onQuote={onQuote} />)
      ) : (
        <div className="connections-empty starred-empty">
          <i className="fa-solid fa-star" aria-hidden="true" />
          <p>No starred posts yet.</p>
          <span>Star a post to find it here.</span>
        </div>
      )}
    </div>
  );
}
