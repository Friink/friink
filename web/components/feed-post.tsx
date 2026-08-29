"use client";

import Link from 'next/link';
import { ProfileCard } from '@/components/profile-card';
import type { Post } from '@/lib/data';

type FeedPostProps = {
  post: Post;
  highlightedStar?: boolean;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  truncateBody?: boolean;
  truncateQuotedPost?: boolean;
};

export function FeedPost({ post, highlightedStar = false, onReply, onQuote, truncateBody = true, truncateQuotedPost = true }: FeedPostProps) {
  return (
    <article className="feed-post">
      <div className="feed-post-heading">
        <Link className="feed-post-profile-link" href={`/${post.handle.replace('@', '')}`} aria-label={`Open ${post.name} profile`}>
          <ProfileCard name={post.name} handle={post.handle} tone={post.tone} initials={post.initials} />
        </Link>
        <button className={`icon-plain feed-post-star${highlightedStar ? ' feed-post-star-highlighted' : ''}`} type="button" aria-label="Starred post">
          <i className={highlightedStar ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" />
        </button>
        <button className="icon-plain feed-post-more" type="button" aria-label="Post options">
          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
        </button>
      </div>
      <div className="feed-post-date">
        <small>{post.date}</small>
      </div>
      <p className={`feed-post-body${truncateBody ? ' feed-post-body-clamped' : ''}`}>{post.text}</p>
      {truncateBody && (
        <Link className="feed-post-show-more" href={`/posts/${post.id}`} aria-label={`Show full post by ${post.name}`}>
          Show more...
        </Link>
      )}
      {post.quotedPost && (
        <div className={`feed-post-quote${post.quotedPost.unavailable ? ' feed-post-quote-unavailable' : ''}`}>
          {post.quotedPost.authorUsername ? (
            <ProfileCard
              name={post.quotedPost.authorDisplayName || `@${post.quotedPost.authorUsername}`}
              handle={`@${post.quotedPost.authorUsername}`}
              tone="mint"
            />
          ) : (
            <strong>Original post unavailable</strong>
          )}
          <p className={`feed-post-quote-body${truncateQuotedPost ? ' feed-post-quote-body-clamped' : ''}`}>{post.quotedPost.content}</p>
          {truncateQuotedPost && <span className="feed-post-quote-more">...</span>}
        </div>
      )}
      <div className="feed-post-actions">
        <button type="button" aria-label={`Comment (${post.replies})`} onClick={() => onReply?.(post)}>
          <i className="fa-regular fa-comment" aria-hidden="true" />
          <span>{post.replies}</span>
        </button>
        <button type="button" aria-label={`Quote (${post.quotes})`} onClick={() => onQuote?.(post)}>
          <i className="fa-solid fa-quote-right" aria-hidden="true" />
          <span>{post.quotes}</span>
        </button>
        <button type="button" aria-label="Like">
          <i className="fa-regular fa-heart" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Share">
          <i className="fa-solid fa-share-nodes" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
