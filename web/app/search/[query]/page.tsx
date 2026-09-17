import { AppShellRoute } from '@/components/app-shell-route';

type SearchQueryPageProps = {
  params: Promise<{ query: string }>;
};

export default async function SearchQueryPage({ params }: SearchQueryPageProps) {
  const { query } = await params;
  return <AppShellRoute initialScreen="search" initialSearchQuery={query} />;
}
