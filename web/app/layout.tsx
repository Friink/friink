import type { Metadata } from 'next';
import { themeToCssVars } from '@/theme.config';
import './globals.css';

export const metadata: Metadata = {
  title: 'Friink | Your people, in one place',
  description: 'A calmer way to stay close to your people.',
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
