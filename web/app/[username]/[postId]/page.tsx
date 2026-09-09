import { notFound, permanentRedirect } from 'next/navigation';
import { fetchApi } from '@/lib/api-origin';
import { getPostPath, getPublicIdFromPostSegment } from '@/lib/post-path';
import { PostClient } from './post-client';

type PostPageProps = {
  params: Promise<{
    username: string;
    postId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type PostSearchParams = Record<string, string | string[] | undefined>;

type RoutePostResponse = {
  id: string;
  author_username: string;
  public_id: string;
  slug: string;
};

function normalizeUsername(value: string) {
  return decodeURIComponent(value).replace(/^@/, '').trim().toLowerCase();
}

function buildQueryString(searchParams: PostSearchParams | undefined) {
  if (!searchParams) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const [{ username, postId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const publicId = getPublicIdFromPostSegment(postId);
  if (!publicId) notFound();

  let post: RoutePostResponse;
  try {
    const response = await fetchApi(`/posts/public/${encodeURIComponent(publicId)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      notFound();
    }

    post = (await response.json()) as RoutePostResponse;
  } catch {
    notFound();
  }

  const canonicalPath = getPostPath(post.author_username, post.slug, post.public_id);
  const requestedPath = `/${encodeURIComponent(username)}/${encodeURIComponent(postId)}`;
  if (requestedPath.toLowerCase() !== canonicalPath.toLowerCase()) {
    permanentRedirect(`${canonicalPath}${buildQueryString(resolvedSearchParams)}`);
  }

  return <PostClient postId={post.id} />;
}
