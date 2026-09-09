import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDisplayNameForUsername, isReservedProfileRoute } from '@/lib/profile-display';

type ProfileLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    username: string;
  }>;
};

export async function generateMetadata({ params }: ProfileLayoutProps): Promise<Metadata> {
  const { username } = await params;
  if (isReservedProfileRoute(username)) {
    notFound();
  }

  return {
    title: {
      absolute: `Friink | ${getDisplayNameForUsername(username)}`,
    },
  };
}

export default function ProfileLayout({ children }: Readonly<ProfileLayoutProps>) {
  return children;
}
