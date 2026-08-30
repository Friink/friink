import { permanentRedirect } from 'next/navigation';

type ConnectionsPageProps = {
  searchParams?: { tab?: string };
};

function getInitialFilter(tab?: string): 'all' | 'followers' | 'following' | 'requests' {
  return tab === 'followers' || tab === 'following' || tab === 'requests' ? tab : 'all';
}

export default function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  permanentRedirect(`/connections/${getInitialFilter(searchParams?.tab)}`);
}
