 'use client';

import { useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import { TabBar } from '@/components/tab-bar';
import type { Post } from '@/lib/data';

type HomeScreenProps = {
  posts: Post[];
};

type HomeFilter = 'all' | 'connections';

const filters: { id: HomeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'connections', label: 'Connections' },
];

export function HomeScreen({ posts }: HomeScreenProps) {
  const [activeFilter, setActiveFilter] = useState<HomeFilter>('all');
  const filteredPosts = activeFilter === 'connections' ? posts.filter((post) => post.isConnection) : posts;

  return (
    <div className="home-feed">
      <TabBar
        tabs={filters}
        activeId={activeFilter}
        onChange={(id) => setActiveFilter(id as HomeFilter)}
        containerClass="home-filters"
        itemClass="home-filter"
        ariaLabel="Home feed filters"
      />
      {filteredPosts.map((post) => <FeedPost key={post.id} post={post} />)}
    </div>
  );
}
