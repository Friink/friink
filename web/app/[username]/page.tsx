import { notFound } from 'next/navigation';
import { permanentRedirect } from 'next/navigation';
import { isReservedProfileRoute } from '@/lib/profile-display';

type ProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  if (isReservedProfileRoute(username)) {
    notFound();
  }

  permanentRedirect(`/${encodeURIComponent(username)}/posts`);
}
