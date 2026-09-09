import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

export default async function SettingsTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (tab !== 'general' && tab !== 'profile' && tab !== 'account' && tab !== 'subscription' && tab !== 'privacy') notFound();
  return <AppShellRoute initialScreen="settings" refreshCurrentUser initialSettingsTab={tab} />;
}
