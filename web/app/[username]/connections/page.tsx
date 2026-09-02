import { AppShellRoute } from '@/components/app-shell-route';

type UserConnectionsPageProps = {
  params: {
    username: string;
  };
  searchParams?: { tab?: string };
};

function getInitialFilter(tab?: string): 'all' | 'followers' | 'following' {
  return tab === 'followers' || tab === 'following' ? tab : 'all';
}

export default function UserConnectionsPage({ params, searchParams }: UserConnectionsPageProps) {
  return (
    <AppShellRoute
      initialScreen="connections"
      connectionsUsername={params.username}
      initialConnectionsFilter={getInitialFilter(searchParams?.tab)}
    />
  );
}
