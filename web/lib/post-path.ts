import type { Post } from '@/lib/data';

function normalizeUsername(value: string) {
  return value.replace(/^@/, '').trim();
}

export function getPostPath(username: string, postId: string) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPostId = postId.trim();

  if (!normalizedUsername || !normalizedPostId) {
    return '/home';
  }

  return `/${encodeURIComponent(normalizedUsername)}/${encodeURIComponent(normalizedPostId)}`;
}

export function getPostPathForPost(post: Pick<Post, 'handle' | 'id'>) {
  return getPostPath(post.handle, post.id);
}
