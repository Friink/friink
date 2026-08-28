import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Settings',
  },
};

export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
