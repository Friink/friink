import { notFound, redirect } from 'next/navigation';
import { getApiOrigin } from '@/lib/api-origin';
import { getPostPath } from '@/lib/post-path';

type PostPageProps = {
  params: {
    postId: string;
  };
};

type RedirectPostResponse = {
  author_username: string;
};

export default async function PostPage({ params }: PostPageProps) {
  try {
    const response = await fetch(`${getApiOrigin()}/posts/${encodeURIComponent(params.postId)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      notFound();
    }

    const post = (await response.json()) as RedirectPostResponse;
    redirect(getPostPath(post.author_username, params.postId));
  } catch {
    notFound();
  }
}
