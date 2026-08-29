'use client';

import { FeedPost } from '@/components/feed-post';
import { PageSurface } from '@/components/page-surface';
import type { Post } from '@/lib/data';

type HomeScreenProps = {
  posts: Post[];
  activeFilter?: 'all' | 'connections';
  onFilterChange?: (id: string) => void;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
};

export function HomeScreen({ posts, activeFilter = 'all', onFilterChange, onReply, onQuote }: HomeScreenProps) {
  const filteredPosts = activeFilter === 'connections' ? posts.filter((post) => post.isConnection) : posts;

  return (
    <PageSurface className="home-feed" variant="list">
      {filteredPosts.map((post) => <FeedPost key={post.id} post={post} onReply={onReply} onQuote={onQuote} />)}
    </PageSurface>
  );
}
