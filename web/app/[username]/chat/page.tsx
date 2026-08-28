import { notFound } from 'next/navigation';
import { ChatClient } from './chat-client';
import { isReservedProfileRoute } from '@/lib/profile-display';

type ChatPageProps = {
  params: {
    username: string;
  };
};

export default function ChatPage({ params }: ChatPageProps) {
  if (isReservedProfileRoute(params.username)) {
    notFound();
  }

  return <ChatClient username={params.username} />;
}
