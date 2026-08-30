import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

const tabs = new Set(['all', 'followers', 'following', 'requests']);

export default function UserConnectionsTabPage({ params }: { params: { username: string; tab: string } }) {
  if (!tabs.has(params.tab)) notFound();
  return <AppShellRoute initialScreen="connections" connectionsUsername={params.username} initialConnectionsFilter={params.tab as 'all' | 'followers' | 'following' | 'requests'} />;
}
