import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDisplayNameForUsername, isReservedProfileRoute } from '@/lib/profile-display';

type ChatLayoutProps = {
  children: React.ReactNode;
  params: {
    username: string;
  };
};

export function generateMetadata({ params }: ChatLayoutProps): Metadata {
  if (isReservedProfileRoute(params.username)) {
    notFound();
  }

  return {
    title: {
      absolute: `Friink | ${getDisplayNameForUsername(params.username)} Chat`,
    },
  };
}

export default function ChatLayout({ children }: Readonly<ChatLayoutProps>) {
  return children;
}
