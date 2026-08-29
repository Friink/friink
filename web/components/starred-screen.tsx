import { ListRow } from '@/components/list-row';
import { Tabs } from '@/components/tabs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Post } from '@/lib/data';

type StarredScreenProps = {
  posts: Post[];
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
};

export function StarredScreen({ posts, onReply, onQuote }: StarredScreenProps) {
  const [activeTab, setActiveTab] = useState('all');
  const router = useRouter();

  const starredPosts = posts.filter((post) => post.isStarred);

  return (
    <div className="starred-feed">
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
      <div className="starred-list">
        {starredPosts.length > 0 ? (
          starredPosts.map((post) => (
            <ListRow
              key={post.id}
              avatar={<span className={`user-avatar avatar-${post.tone}`}>{post.initials}</span>}
              title={post.name}
              subtitle={post.text}
              meta={post.date}
              trailing={<i className="fa-solid fa-star starred-row-icon" aria-hidden="true" />}
              className="starred-row"
              onClick={() => router.push(`/posts/${post.id}`)}
              ariaLabel={`Open starred post by ${post.name}`}
            >
              <span className="starred-row-actions">
                <button type="button" aria-label={`Comment (${post.replies})`} onClick={(event) => { event.stopPropagation(); onReply?.(post); }}>
                  <i className="fa-regular fa-comment" aria-hidden="true" />
                  <span>{post.replies}</span>
                </button>
                <button type="button" aria-label={`Quote (${post.quotes})`} onClick={(event) => { event.stopPropagation(); onQuote?.(post); }}>
                  <i className="fa-solid fa-quote-right" aria-hidden="true" />
                  <span>{post.quotes}</span>
                </button>
              </span>
            </ListRow>
          ))
        ) : (
          <div className="connections-empty starred-empty">
            <i className="fa-solid fa-star" aria-hidden="true" />
            <p>No starred posts yet.</p>
            <span>Star a post to find it here.</span>
          </div>
        )}
      </div>
    </div>
  );
}
