'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';

export default function AppHomePage() {
  const router = useRouter();

  return <AppShell onLogout={() => router.replace('/login')} />;
}
