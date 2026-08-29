"use client";

import { FeedPost } from '@/components/feed-post';
import type { Post } from '@/lib/data';

type PostDetailScreenProps = {
  post: Post;
  replies?: Post[];
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
};

export function PostDetailScreen({ post, replies = [], onReply, onQuote }: PostDetailScreenProps) {
  return (
    <section className="post-detail-screen">
      <FeedPost post={post} truncateBody={false} truncateQuotedPost={false} onReply={onReply} onQuote={onQuote} />
      <div className="post-thread">
        {replies.length > 0 ? (
          replies.map((reply) => <FeedPost key={reply.id} post={reply} truncateBody={false} truncateQuotedPost={false} onReply={onReply} onQuote={onQuote} />)
        ) : (
          <div className="post-replies-placeholder">
            <i className="fa-regular fa-comment" aria-hidden="true" />
            <p>Replies will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
