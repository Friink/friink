import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

export default function ChatTabPage({ params }: { params: { tab: string } }) {
  if (params.tab !== 'all' && params.tab !== 'muted' && params.tab !== 'requests' && params.tab !== 'archived') notFound();
  return <AppShellRoute initialScreen="messages" initialMessagesTab={params.tab} />;
}
