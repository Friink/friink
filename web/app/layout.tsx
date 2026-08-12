import type { Metadata } from 'next';
import { themeToCssVars } from '@/theme.config';
import './globals.css';

export const metadata: Metadata = {
  title: 'Friink - A place for humans.',
  description: 'A calmer social space unlike anything you have seen so far.',
  icons: {
    icon: '/favicon.png',
  },
};

const themeCss = `:root { ${Object.entries(themeToCssVars())
  .map(([key, value]) => `${key}: ${value}`)
  .join('; ')}; }`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
