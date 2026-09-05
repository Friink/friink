import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Saved',
  },
};

export default function SavedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
