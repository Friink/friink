import { notFound } from 'next/navigation';
import { ProfileClient } from './profile-client';
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

  return <ProfileClient username={params.username} />;
}
