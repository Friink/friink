import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

const tabs = new Set(['all', 'followers', 'following', 'requests']);

export default async function UserConnectionsTabPage({ params }: { params: Promise<{ username: string; tab: string }> }) {
  const { username, tab } = await params;
  if (!tabs.has(tab)) notFound();
  return <AppShellRoute initialScreen="connections" connectionsUsername={username} initialConnectionsFilter={tab as 'all' | 'followers' | 'following' | 'requests'} />;
}
