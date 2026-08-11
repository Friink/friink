import { FeedPost } from '@/components/feed-post';
import type { Post } from '@/lib/data';

type StarredScreenProps = {
  posts: Post[];
};

export function StarredScreen({ posts }: StarredScreenProps) {
  const starredPosts = posts.filter((post) => post.isStarred);

  return (
    <div className="home-feed starred-feed">
      {starredPosts.length > 0 ? (
        starredPosts.map((post) => <FeedPost key={post.id} post={post} highlightedStar />)
      ) : (
        <div className="connections-empty starred-empty">
          <i className="fa-solid fa-star" aria-hidden="true" />
          <p>No starred posts yet.</p>
          <span>Star a post to find it here.</span>
        </div>
      )}
    </div>
  );
}
