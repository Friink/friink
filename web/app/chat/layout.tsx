import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Chat',
  },
};

export default function ChatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
