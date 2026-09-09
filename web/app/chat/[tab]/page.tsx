import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

export default async function ChatTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (tab !== 'all' && tab !== 'muted' && tab !== 'requests' && tab !== 'archived') notFound();
  return <AppShellRoute initialScreen="messages" initialMessagesTab={tab} />;
}
