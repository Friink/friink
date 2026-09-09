import { AppShellRoute } from '@/components/app-shell-route';

type UserConnectionsPageProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams?: Promise<{ tab?: string }>;
};

function getInitialFilter(tab?: string): 'all' | 'followers' | 'following' {
  return tab === 'followers' || tab === 'following' ? tab : 'all';
}

export default async function UserConnectionsPage({ params, searchParams }: UserConnectionsPageProps) {
  const [{ username }, resolvedSearchParams] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  return (
    <AppShellRoute
      initialScreen="connections"
      connectionsUsername={username}
      initialConnectionsFilter={getInitialFilter(resolvedSearchParams?.tab)}
    />
  );
}
