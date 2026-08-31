"use client";

import Link from 'next/link';
import { type MouseEvent, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileCard } from '@/components/profile-card';
import type { Post } from '@/lib/data';
import { getPostPath, getPostPathForPost } from '@/lib/post-path';
import { formatRelativeTime } from '@/lib/time';

type FeedPostProps = {
  post: Post;
  highlightedStar?: boolean;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  truncateBody?: boolean;
  truncateQuotedPost?: boolean;
};

export function FeedPost({ post, highlightedStar = false, onReply, onQuote, truncateBody = true, truncateQuotedPost = true }: FeedPostProps) {
  const router = useRouter();
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [bodyOverflows, setBodyOverflows] = useState(false);
  const postPath = getPostPathForPost(post);
  const shouldClampBody = !isExpanded;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const measureBody = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(body).lineHeight);
      const maxCollapsedHeight = Number.isFinite(lineHeight) ? lineHeight * 4 : 0;
      setBodyOverflows(maxCollapsedHeight > 0 && body.scrollHeight > maxCollapsedHeight + 1);
    };

    measureBody();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureBody);
    observer.observe(body);
    return () => observer.disconnect();
  }, [post.text]);

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('a, button')) return;

    router.push(postPath);
  }

  return (
    <article
      className="feed-post feed-post-clickable"
      onClick={handleCardClick}
      aria-label={`Open post by ${post.name}`}
    >
      <div className="feed-post-heading">
        <Link className="feed-post-profile-link" href={`/${post.handle.replace('@', '')}`} aria-label={`Open ${post.name} profile`}>
          <ProfileCard name={post.name} handle={post.handle} tone={post.tone} initials={post.initials} imageUrl={post.imageUrl} />
        </Link>
        <div className="feed-post-options" aria-label="Post actions">
          <button className={`icon-plain feed-post-star${highlightedStar ? ' feed-post-star-highlighted' : ''}`} type="button" aria-label="Starred post">
            <i className={highlightedStar ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" />
          </button>
          <button className="icon-plain feed-post-more" type="button" aria-label="Post options">
            <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="feed-post-date">
        <small>{formatRelativeTime(post.createdAt)}</small>
      </div>
      <p ref={bodyRef} className={`feed-post-body${shouldClampBody ? ' feed-post-body-clamped' : ''}`}>{post.text}</p>
      {post.quotedPost && (
        (() => {
          const quotedPost = post.quotedPost;
          const quotedPostPath = quotedPost.authorUsername && quotedPost.publicId
            ? getPostPath(quotedPost.authorUsername, quotedPost.slug ?? '', quotedPost.publicId)
            : null;
          const quoteContent = (
            <div className={`feed-post-quote${quotedPost.unavailable ? ' feed-post-quote-unavailable' : ''}`}>
              {quotedPost.authorUsername ? (
                <ProfileCard
                  name={quotedPost.authorDisplayName || `@${quotedPost.authorUsername}`}
                  handle={`@${quotedPost.authorUsername}`}
                  tone="mint"
                />
              ) : (
                <strong>Original post unavailable</strong>
              )}
              <p className={`feed-post-quote-body${truncateQuotedPost ? ' feed-post-quote-body-clamped' : ''}`}>{quotedPost.content}</p>
              {truncateQuotedPost && <span className="feed-post-quote-more">...</span>}
            </div>
          );

          return quotedPostPath ? (
            <Link className="feed-post-quote-link" href={quotedPostPath} aria-label={`Open quoted post by ${quotedPost.authorUsername}`}>
              {quoteContent}
            </Link>
          ) : quoteContent;
        })()
      )}
      {bodyOverflows && !isExpanded && (
        <button
          className="feed-post-show-more"
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-label={`Show full post text by ${post.name}`}
        >
          Show more...
        </button>
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
