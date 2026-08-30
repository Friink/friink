import { ProfileClient } from '../profile-client';

export default function UserPostsPage({ params }: { params: { username: string } }) {
  return <ProfileClient username={params.username} initialTab="posts" />;
}
