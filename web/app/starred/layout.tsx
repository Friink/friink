import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Starred',
  },
};

export default function StarredLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
