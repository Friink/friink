import { notFound } from 'next/navigation';
import { permanentRedirect } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

export default async function HomeTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (tab === 'explore') return <AppShellRoute initialScreen="home" initialHomeFilter="all" />;
  if (tab === 'following') return <AppShellRoute initialScreen="home" initialHomeFilter="following" />;
  if (tab === 'connections') permanentRedirect('/home/following');
  notFound();
}
