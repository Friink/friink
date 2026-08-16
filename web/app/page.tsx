'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadAuthSession } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = loadAuthSession();
    if (session) {
      router.replace('/home');
    }
  }, [router]);

  return (
    <iframe
      className="public-site-frame"
      src="/friink-site/index.html"
      title="Friink - A place for humans."
    />
  );
}
