"use client";

import { FeedPost } from '@/components/feed-post';
import type { Post } from '@/lib/data';
import { getPostPathForPost } from '@/lib/post-path';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

type PostDetailScreenProps = {
  post: Post;
  replies?: Post[];
  ancestors?: Post[];
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onPostUpdated?: (post: Post) => void;
  onReactionError?: (message: string) => void;
  reactionError?: string;
};

export function PostDetailScreen({ post, replies = [], ancestors = [], onReply, onQuote, onPostUpdated, onReactionError, reactionError }: PostDetailScreenProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const children = useMemo(() => {
    const result = new Map<string, Post[]>();
    for (const reply of replies) {
      const parentId = reply.parentPostId || post.id;
      result.set(parentId, [...(result.get(parentId) || []), reply]);
    }
    return result;
  }, [post.id, replies]);

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function renderReplies(parentId: string, depth: number): ReactNode {
    return (children.get(parentId) || []).map((reply) => {
      const descendants = children.get(reply.id) || [];
      const isCollapsed = collapsed.has(reply.id);
      return (
        <div className={`post-thread-node post-thread-depth-${Math.min(depth, 3)}`} key={reply.id}>
          <FeedPost post={reply} threadDepth={depth} replyContext={depth > 3 ? 'the parent reply' : undefined} truncateBody={false} truncateQuotedPost={false} onReply={onReply} onQuote={onQuote} onPostUpdated={onPostUpdated} onReactionError={onReactionError} />
          {descendants.length > 0 && <button className="post-thread-toggle" type="button" onClick={() => toggle(reply.id)} aria-expanded={!isCollapsed}>{isCollapsed ? `View ${descendants.length} replies` : 'Hide replies'}</button>}
          {!isCollapsed && renderReplies(reply.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <section className="post-detail-screen">
      {ancestors.length > 0 && <nav className="post-thread-ancestors" aria-label="Conversation context">
        {ancestors.map((ancestor) => <Link key={ancestor.id} href={getPostPathForPost(ancestor)}>@{ancestor.handle.replace('@', '')}</Link>)}
        <span aria-hidden="true">›</span>
        <strong>Focused reply</strong>
      </nav>}
      <FeedPost post={post} truncateBody={false} truncateQuotedPost={false} onReply={onReply} onQuote={onQuote} onPostUpdated={onPostUpdated} onReactionError={onReactionError} />
      {reactionError && <p className="post-reaction-message" role="status">{reactionError}</p>}
      <div className="post-thread">
        {replies.length > 0 ? (
          renderReplies(post.id, 1)
        ) : (
          <div className="post-replies-placeholder">
            <i className="fa-regular fa-comment" aria-hidden="true" />
            <p>Replies will appear here.</p>
          </div>
        )}
      </div>
      {post.kind === 'reply' && ancestors[0] && <Link className="post-thread-full-link" href={getPostPathForPost(ancestors[0])}>View full conversation</Link>}
    </section>
  );
}
