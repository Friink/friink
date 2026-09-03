import { ProfileClient } from '../profile-client';

export default function UserLikesPage({ params }: { params: { username: string } }) {
  return <ProfileClient username={params.username} initialTab="likes" />;
}
