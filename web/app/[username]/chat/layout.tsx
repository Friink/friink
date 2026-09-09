import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDisplayNameForUsername, isReservedProfileRoute } from '@/lib/profile-display';

type ChatLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    username: string;
  }>;
};

export async function generateMetadata({ params }: ChatLayoutProps): Promise<Metadata> {
  const { username } = await params;
  if (isReservedProfileRoute(username)) {
    notFound();
  }

  return {
    title: {
      absolute: `Friink | ${getDisplayNameForUsername(username)} Chat`,
    },
  };
}

export default function ChatLayout({ children }: Readonly<ChatLayoutProps>) {
  return children;
}
