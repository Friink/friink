import { AppShellRoute } from '@/components/app-shell-route';

export default function SettingsPage() {
  return <AppShellRoute initialScreen="settings" refreshCurrentUser />;
}
