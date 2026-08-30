import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { themeToCssVars } from '@/theme.config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Friink',
    template: 'Friink | %s',
  },
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
