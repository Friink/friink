import { AppShellRoute } from '@/components/app-shell-route';

// The route is reserved in Phase 2. The one-person selection modal is Phase 3.
export default function NewChatPage() {
  return <AppShellRoute initialScreen="messages" />;
}
