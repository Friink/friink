import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Friink | Your people, in one place',
  description: 'A calmer way to stay close to your people.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
