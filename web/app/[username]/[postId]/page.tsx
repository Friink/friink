import { notFound, permanentRedirect } from 'next/navigation';
import { getApiOrigin } from '@/lib/api-origin';
import { getPostPath } from '@/lib/post-path';
import { PostClient } from './post-client';

type PostPageProps = {
  params: {
    username: string;
    postId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

type RoutePostResponse = {
  author_username: string;
};

function normalizeUsername(value: string) {
  return decodeURIComponent(value).replace(/^@/, '').trim().toLowerCase();
}

function buildQueryString(searchParams: PostPageProps['searchParams']) {
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
  try {
    const response = await fetch(`${getApiOrigin()}/posts/${encodeURIComponent(params.postId)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      notFound();
    }

    const post = (await response.json()) as RoutePostResponse;
    const canonicalUsername = normalizeUsername(post.author_username);
    const requestedUsername = normalizeUsername(params.username);

    if (requestedUsername !== canonicalUsername) {
      permanentRedirect(`${getPostPath(post.author_username, params.postId)}${buildQueryString(searchParams)}`);
    }
  } catch {
    notFound();
  }

  return <PostClient postId={params.postId} />;
}
