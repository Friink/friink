import { notFound } from 'next/navigation';
import { permanentRedirect } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

export default function HomeTabPage({ params }: { params: { tab: string } }) {
  if (params.tab === 'explore') return <AppShellRoute initialScreen="home" initialHomeFilter="all" />;
  if (params.tab === 'following') return <AppShellRoute initialScreen="home" initialHomeFilter="following" />;
  if (params.tab === 'connections') permanentRedirect('/home/following');
  notFound();
}
