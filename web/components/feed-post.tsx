"use client";

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { ProfileCard } from '@/components/profile-card';
import type { Post } from '@/lib/data';

type FeedPostProps = {
  post: Post;
  highlightedStar?: boolean;
  onQuote?: (post: Post) => void;
  truncateBody?: boolean;
};

export function FeedPost({ post, highlightedStar = false, onQuote, truncateBody = true }: FeedPostProps) {
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    if (!truncateBody || !bodyRef.current) {
      setIsOverflowing(false);
      return;
    }

    const element = bodyRef.current;
    const updateOverflow = () => {
      setIsOverflowing(element.scrollHeight > element.clientHeight + 1);
    };

    updateOverflow();
    window.addEventListener('resize', updateOverflow);
    return () => window.removeEventListener('resize', updateOverflow);
  }, [post.text, truncateBody]);

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
      <p ref={bodyRef} className={`feed-post-body${truncateBody ? ' feed-post-body-clamped' : ''}`}>{post.text}</p>
      {truncateBody && isOverflowing && (
        <Link className="feed-post-show-more" href={`/posts/${post.id}`} aria-label={`Show full post by ${post.name}`}>
          Show more...
        </Link>
      )}
      {post.quotedPost && (
        <div className={`feed-post-quote${post.quotedPost.unavailable ? ' feed-post-quote-unavailable' : ''}`}>
          <strong>{post.quotedPost.authorUsername ? `@${post.quotedPost.authorUsername}` : 'Original post unavailable'}</strong>
          <p className="feed-post-quote-body">{post.quotedPost.content}</p>
        </div>
      )}
      <div className="feed-post-actions">
        <button type="button" aria-label="Comment">
          <i className="fa-regular fa-comment" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Quote" onClick={() => onQuote?.(post)}>
          <i className="fa-solid fa-quote-right" aria-hidden="true" />
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
