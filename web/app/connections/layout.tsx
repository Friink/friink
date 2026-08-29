import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Connections',
  },
};

export default function ConnectionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
