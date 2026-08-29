import { notFound, redirect } from 'next/navigation';
import { getPostPath } from '@/lib/post-path';

type PostPageProps = {
  params: {
    postId: string;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type RedirectPostResponse = {
  author_username: string;
};

export default async function PostPage({ params }: PostPageProps) {
  try {
    const response = await fetch(`${API_BASE_URL}/posts/${encodeURIComponent(params.postId)}`, {
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
