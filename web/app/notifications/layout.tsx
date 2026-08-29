import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Notifications',
  },
};

export default function NotificationsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
