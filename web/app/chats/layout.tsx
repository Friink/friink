import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Chat',
  },
};

export default function ChatsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
