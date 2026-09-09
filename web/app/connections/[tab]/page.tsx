import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

const tabs = new Set(['all', 'followers', 'following', 'requests']);

export default async function ConnectionsTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!tabs.has(tab)) notFound();
  return <AppShellRoute initialScreen="connections" initialConnectionsFilter={tab as 'all' | 'followers' | 'following' | 'requests'} />;
}
