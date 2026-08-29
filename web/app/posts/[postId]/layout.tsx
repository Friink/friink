import type { Metadata } from 'next';
import { getApiOrigin } from '@/lib/api-origin';

type PostLayoutProps = {
  children: React.ReactNode;
  params: {
    postId: string;
  };
};

type MetadataPostResponse = {
  author_display_name: string | null;
  author_username: string;
};

export async function generateMetadata({ params }: PostLayoutProps): Promise<Metadata> {
  try {
    const response = await fetch(`${getApiOrigin()}/posts/${encodeURIComponent(params.postId)}`, {
      cache: 'no-store',
    });

    if (response.ok) {
      const post = (await response.json()) as MetadataPostResponse;
      const authorName = post.author_display_name || post.author_username;
      return {
        title: {
          absolute: `Friink | Post by ${authorName}`,
        },
      };
    }
  } catch {
    // Fall back to a generic title when the post is unavailable during metadata generation.
  }

  return {
    title: {
      absolute: 'Friink | Post',
    },
  };
}

export default function PostLayout({ children }: Readonly<PostLayoutProps>) {
  return children;
}
