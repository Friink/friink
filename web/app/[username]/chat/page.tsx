import { notFound } from 'next/navigation';
import { ChatClient } from './chat-client';
import { isReservedProfileRoute } from '@/lib/profile-display';

type ChatPageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { username } = await params;
  if (isReservedProfileRoute(username)) {
    notFound();
  }

  return <ChatClient username={username} />;
}
