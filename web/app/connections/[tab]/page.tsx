import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

const tabs = new Set(['all', 'followers', 'following', 'requests']);

export default function ConnectionsTabPage({ params }: { params: { tab: string } }) {
  if (!tabs.has(params.tab)) notFound();
  return <AppShellRoute initialScreen="connections" initialConnectionsFilter={params.tab as 'all' | 'followers' | 'following' | 'requests'} />;
}
