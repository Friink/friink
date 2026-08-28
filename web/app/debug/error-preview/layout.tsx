import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Error (500)',
  },
};

export default function ErrorPreviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
