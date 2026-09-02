import type { Post } from '@/lib/data';

function normalizeUsername(value: string) {
  return value.replace(/^@/, '').trim();
}

export function getPostPath(username: string, slug: string, publicId: string) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedSlug = slug.trim();
  const normalizedPublicId = publicId.trim();

  if (!normalizedUsername || !normalizedPublicId) {
    return '/home';
  }

  const segment = normalizedSlug ? `${normalizedSlug}-${normalizedPublicId}` : normalizedPublicId;
  return `/${encodeURIComponent(normalizedUsername)}/${encodeURIComponent(segment)}`;
}

export function getPostPathForPost(post: Pick<Post, 'handle' | 'publicId' | 'slug'>) {
  if (!post.publicId) return '/home';
  return getPostPath(post.handle, post.slug ?? '', post.publicId);
}

export function getPublicIdFromPostSegment(segment: string) {
  const decoded = decodeURIComponent(segment).trim();
  const candidate = decoded.includes('-') ? decoded.slice(decoded.lastIndexOf('-') + 1) : decoded;
  return /^[A-Za-z0-9]{8}$/.test(candidate) ? candidate : null;
}
