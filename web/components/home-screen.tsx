import type { Post } from '@/lib/data';

type HomeScreenProps = {
  posts: Post[];
};

export function HomeScreen({ posts }: HomeScreenProps) {
  return (
    <div className="home-feed">
      {posts.map((post) => (
        <article className="feed-post" key={post.id}>
          <div className="feed-post-heading">
            <span className={`user-avatar avatar-${post.tone}`}>{post.initials}</span>
            <div className="feed-post-meta">
              <strong>{post.name}</strong>
              <small>
                {post.handle}&nbsp;&nbsp;{post.date}
              </small>
            </div>
            <button className="icon-plain feed-post-star" type="button" aria-label="Save post">
              <i className="fa-regular fa-star" aria-hidden="true" />
            </button>
            <button className="icon-plain feed-post-more" type="button" aria-label="Post options">
              <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
            </button>
          </div>
          <p className="feed-post-body">{post.text}</p>
          <div className="feed-post-actions">
            <button type="button" aria-label="Comment">
              <i className="fa-regular fa-comment" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Quote">
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
      ))}
    </div>
  );
}
