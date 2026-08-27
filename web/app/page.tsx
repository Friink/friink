'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadPersistedAuthSession } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (loadPersistedAuthSession()) {
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
