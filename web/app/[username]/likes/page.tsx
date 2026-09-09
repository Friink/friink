import { ProfileClient } from '../profile-client';

export default async function UserLikesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfileClient username={username} initialTab="likes" />;
}
