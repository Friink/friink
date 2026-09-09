import { permanentRedirect } from 'next/navigation';

type ConnectionsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

function getInitialFilter(tab?: string): 'all' | 'followers' | 'following' | 'requests' {
  return tab === 'followers' || tab === 'following' || tab === 'requests' ? tab : 'all';
}

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve(undefined));
  permanentRedirect(`/connections/${getInitialFilter(resolvedSearchParams?.tab)}`);
}
