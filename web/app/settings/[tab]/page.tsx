import { notFound } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';

export default function SettingsTabPage({ params }: { params: { tab: string } }) {
  if (params.tab !== 'general' && params.tab !== 'profile' && params.tab !== 'account' && params.tab !== 'subscription' && params.tab !== 'privacy') notFound();
  return <AppShellRoute initialScreen="settings" refreshCurrentUser initialSettingsTab={params.tab} />;
}
