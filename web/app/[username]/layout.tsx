import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDisplayNameForUsername, isReservedProfileRoute } from '@/lib/profile-display';

type ProfileLayoutProps = {
  children: React.ReactNode;
  params: {
    username: string;
  };
};

export function generateMetadata({ params }: ProfileLayoutProps): Metadata {
  if (isReservedProfileRoute(params.username)) {
    notFound();
  }

  return {
    title: {
      absolute: `Friink | ${getDisplayNameForUsername(params.username)}`,
    },
  };
}

export default function ProfileLayout({ children }: Readonly<ProfileLayoutProps>) {
  return children;
}
