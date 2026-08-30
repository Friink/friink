import { ProfileClient } from '../profile-client';

export default function UserRepliesPage({ params }: { params: { username: string } }) {
  return <ProfileClient username={params.username} initialTab="replies" />;
}
