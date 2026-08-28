"use client";

import { FeedPost } from '@/components/feed-post';
import type { Post } from '@/lib/data';

type PostDetailScreenProps = {
  post: Post;
};

export function PostDetailScreen({ post }: PostDetailScreenProps) {
  return (
    <section className="post-detail-screen">
      <FeedPost post={post} truncateBody={false} />
      <div className="post-replies-placeholder">
        <i className="fa-regular fa-comment" aria-hidden="true" />
        <p>Replies will appear here.</p>
      </div>
    </section>
  );
}
