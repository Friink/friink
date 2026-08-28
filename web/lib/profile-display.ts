import { mockConversations } from '@/lib/mock-conversations';

const reservedProfileRoutes = new Set(['compose', 'dev-settings', 'floating']);

export function isReservedProfileRoute(username: string) {
  return reservedProfileRoutes.has(username.replace(/^@/, '').toLowerCase());
}

export function getDisplayNameForUsername(username: string) {
  const normalized = username.replace(/^@/, '');
  const handle = `@${normalized}`;
  const conversation = mockConversations.find((item) => item.handle.toLowerCase() === handle.toLowerCase());

  return conversation?.name ?? `@${normalized}`;
}

export function getInitialsForUsername(username: string) {
  const displayName = getDisplayNameForUsername(username);

  return (
    displayName
      .replace(/^@/, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}
