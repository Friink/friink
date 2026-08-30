import { notFound } from 'next/navigation';
import { permanentRedirect } from 'next/navigation';
import { isReservedProfileRoute } from '@/lib/profile-display';

type ProfilePageProps = {
  params: {
    username: string;
  };
};

export default function UserProfilePage({ params }: ProfilePageProps) {
  if (isReservedProfileRoute(params.username)) {
    notFound();
  }

  permanentRedirect(`/${encodeURIComponent(params.username)}/posts`);
}
