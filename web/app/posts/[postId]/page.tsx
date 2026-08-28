import { PostClient } from './post-client';

type PostPageProps = {
  params: {
    postId: string;
  };
};

export default function PostPage({ params }: PostPageProps) {
  return <PostClient postId={params.postId} />;
}
