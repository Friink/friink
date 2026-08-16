 'use client';

import { useState } from 'react';
import { FeedPost } from '@/components/feed-post';
import type { Post } from '@/lib/data';

type HomeScreenProps = {
  posts: Post[];
  activeFilter?: 'all' | 'connections';
  onFilterChange?: (id: string) => void;
};

export function HomeScreen({ posts, activeFilter = 'all', onFilterChange }: HomeScreenProps) {
  const filteredPosts = activeFilter === 'connections' ? posts.filter((post) => post.isConnection) : posts;

  return (
    <div className="home-feed">
      {filteredPosts.map((post) => <FeedPost key={post.id} post={post} />)}
    </div>
  );
}
