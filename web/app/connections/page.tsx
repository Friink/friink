import { AppShellRoute } from '@/components/app-shell-route';

type ConnectionsPageProps = {
  searchParams?: { tab?: string };
};

function getInitialFilter(tab?: string): 'all' | 'followers' | 'following' | 'requests' {
  return tab === 'followers' || tab === 'following' || tab === 'requests' ? tab : 'all';
}

export default function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  return <AppShellRoute initialScreen="connections" initialConnectionsFilter={getInitialFilter(searchParams?.tab)} />;
}
