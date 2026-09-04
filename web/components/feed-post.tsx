"use client";

import Link from 'next/link';
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileCard } from '@/components/profile-card';
import { MentionText } from '@/components/mention-text';
import { PostMediaGallery } from '@/components/post-media-gallery';
import type { Post } from '@/lib/data';
import { getPostPath, getPostPathForPost } from '@/lib/post-path';
import { formatRelativeTime } from '@/lib/time';
import { loadAuthSession, setPostLike, setPostStar } from '@/lib/auth';
import { PostLikesModal } from '@/components/post-likes-modal';

type FeedPostProps = {
  post: Post;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onPostUpdated?: (post: Post) => void;
  onReactionError?: (message: string) => void;
  truncateBody?: boolean;
  truncateQuotedPost?: boolean;
};

export function FeedPost({ post, onReply, onQuote, onPostUpdated, onReactionError, truncateBody = true, truncateQuotedPost = true }: FeedPostProps) {
  const router = useRouter();
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [bodyOverflows, setBodyOverflows] = useState(false);
  const [reactionPost, setReactionPost] = useState(post);
  const [reactionBusy, setReactionBusy] = useState<'like' | 'star' | null>(null);
  const [likesOpen, setLikesOpen] = useState(false);
  const postPath = getPostPathForPost(post);
  const shouldClampBody = !isExpanded;
  const canReact = reactionPost.kind !== 'reply';

  useEffect(() => {
    setReactionPost(post);
  }, [post]);

  async function toggleReaction(kind: 'like' | 'star') {
    const session = loadAuthSession();
    if (!session || reactionBusy) return;
    const nextValue = kind === 'like' ? !reactionPost.isLiked : !reactionPost.isStarred;
    const optimistic = {
      ...reactionPost,
      ...(kind === 'like' ? { isLiked: nextValue, likeCount: Math.max(0, reactionPost.likeCount + (nextValue ? 1 : -1)) } : { isStarred: nextValue, starCount: Math.max(0, reactionPost.starCount + (nextValue ? 1 : -1)) }),
    };
    setReactionPost(optimistic);
    onPostUpdated?.(optimistic);
    setReactionBusy(kind);
    try {
      const result = kind === 'like'
        ? await setPostLike(session.accessToken, reactionPost.id, nextValue)
        : await setPostStar(session.accessToken, reactionPost.id, nextValue);
      const confirmed = { ...reactionPost, isLiked: result.liked, isStarred: result.starred, likeCount: result.like_count, starCount: result.star_count };
      setReactionPost(confirmed);
      onPostUpdated?.(confirmed);
    } catch (error) {
      setReactionPost(reactionPost);
      onPostUpdated?.(reactionPost);
      onReactionError?.(error instanceof Error ? error.message : `Could not update ${kind}.`);
    } finally {
      setReactionBusy(null);
    }
  }

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
    <>
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
          {canReact && (
            <button className={`icon-plain feed-post-star${reactionPost.isStarred ? ' feed-post-star-highlighted' : ''}`} type="button" aria-label={reactionPost.isStarred ? 'Unstar post' : 'Star post'} aria-pressed={reactionPost.isStarred} disabled={reactionBusy !== null} onClick={() => { void toggleReaction('star'); }}>
              <i className={reactionPost.isStarred ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" />
            </button>
          )}
          <button className="icon-plain feed-post-share" type="button" aria-label="Share post">
            <i className="fa-solid fa-share-nodes" aria-hidden="true" />
          </button>
          <button className="icon-plain feed-post-more" type="button" aria-label="Post options">
            <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="feed-post-date">
        <small>{formatRelativeTime(post.createdAt)}</small>
      </div>
      <p ref={bodyRef} className={`feed-post-body${shouldClampBody ? ' feed-post-body-clamped' : ''}`}><MentionText>{post.text}</MentionText></p>
      <PostMediaGallery urls={post.media ?? []} authorName={post.name} />
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
                  imageUrl={quotedPost.imageUrl}
                />
              ) : (
                <strong>Original post unavailable</strong>
              )}
              <p className={`feed-post-quote-body${truncateQuotedPost ? ' feed-post-quote-body-clamped' : ''}`}><MentionText>{quotedPost.content}</MentionText></p>
              <PostMediaGallery urls={quotedPost.media ?? []} authorName={quotedPost.authorDisplayName || quotedPost.authorUsername || 'Original'} />
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
        <button type="button" aria-label={`Comment (${reactionPost.replies})`} onClick={() => onReply?.(reactionPost)}>
          <i className="fa-regular fa-comment" aria-hidden="true" />
          <span>{reactionPost.replies}</span>
        </button>
        <button type="button" aria-label={`Quote (${reactionPost.quotes})`} onClick={() => onQuote?.(reactionPost)}>
          <i className="fa-solid fa-quote-right" aria-hidden="true" />
          <span>{reactionPost.quotes}</span>
        </button>
        {canReact && (
          <>
            <span className="feed-post-action-group">
              <button className={reactionPost.isLiked ? 'feed-post-action-active' : ''} type="button" aria-label={reactionPost.isLiked ? 'Unlike post' : 'Like post'} aria-pressed={reactionPost.isLiked} disabled={reactionBusy !== null} onClick={() => { void toggleReaction('like'); }}>
                <i className={reactionPost.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} aria-hidden="true" />
              </button>
              <button className="feed-post-count" type="button" aria-label={`View ${reactionPost.likeCount} likes`} onClick={() => setLikesOpen(true)}>{reactionPost.likeCount}</button>
            </span>
            <span className="feed-post-action-group feed-post-star-count">
              <span className={reactionPost.isStarred ? 'feed-post-action-active' : ''} aria-label={`${reactionPost.starCount} stars`}>
                <i className={reactionPost.isStarred ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" />
              </span>
              <span>{reactionPost.starCount}</span>
            </span>
          </>
        )}
      </div>
    </article>
    {likesOpen && <PostLikesModal postId={reactionPost.id} onClose={() => setLikesOpen(false)} />}
    </>
  );
}
