import Link from 'next/link';
import { ProfileCard } from '@/components/profile-card';
import type { Post } from '@/lib/data';

type FeedPostProps = {
  post: Post;
  highlightedStar?: boolean;
  onQuote?: (post: Post) => void;
};

export function FeedPost({ post, highlightedStar = false, onQuote }: FeedPostProps) {
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
      <p className="feed-post-body">{post.text}</p>
      {post.quotedPost && (
        <div className={`feed-post-quote${post.quotedPost.unavailable ? ' feed-post-quote-unavailable' : ''}`}>
          <strong>{post.quotedPost.authorUsername ? `@${post.quotedPost.authorUsername}` : 'Original post unavailable'}</strong>
          <p>{post.quotedPost.content}</p>
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
