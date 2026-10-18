import type { Metadata } from 'next';
import '@friink/auth-ui/styles.css';

export const metadata: Metadata = {
  title: { default: 'Friink Auth', template: 'Friink | %s' },
  description: 'Friink authentication',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
