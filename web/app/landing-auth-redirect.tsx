"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadPersistedAuthSession } from '@/lib/auth';

export function LandingAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (loadPersistedAuthSession()) {
      router.replace('/home');
    }
  }, [router]);

  return null;
}
