'use client';

import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { formatRelativeTime } from '@/lib/time';

type NotificationKind = 'request' | 'like' | 'service' | 'reply' | 'login' | 'verification' | 'follow';

type NotificationItem = {
  id: number;
  kind: NotificationKind;
  name: string;
  handle: string;
  text: string;
  createdAt: string;
  initials: string;
  tone: 'coral' | 'sage' | 'sun' | 'mint';
  unread?: boolean;
};

function isoOffsetFromNow(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString();
}

const notifications: NotificationItem[] = [
  {
    id: 1,
    kind: 'request',
    name: 'Maya Chen',
    handle: '@mayachen',
    text: 'sent a follow request.',
    createdAt: isoOffsetFromNow(57 * 60 * 1000),
    initials: 'MC',
    tone: 'coral',
    unread: true,
  },
  {
    id: 2,
    kind: 'like',
    name: 'Jon Bell',
    handle: '@jonbell',
    text: 'liked your post.',
    createdAt: isoOffsetFromNow(4 * 60 * 60 * 1000),
    initials: 'JB',
    tone: 'sage',
  },
  {
    id: 3,
    kind: 'service',
    name: 'Priya Shah',
    handle: '@priyashah',
    text: 'is interested in your service.',
    createdAt: '2026-02-28T12:00:00Z',
    initials: 'PS',
    tone: 'sun',
  },
  {
    id: 4,
    kind: 'reply',
    name: 'Alina Ross',
    handle: '@alinaross',
    text: 'replied to your post.',
    createdAt: '2026-01-31T09:15:00Z',
    initials: 'AR',
    tone: 'mint',
  },
  {
    id: 5,
    kind: 'verification',
    name: 'Friink Review',
    handle: '@friink',
    text: 'updated your verification status.',
    createdAt: isoOffsetFromNow(25 * 60 * 60 * 1000),
    initials: 'FR',
    tone: 'sage',
  },
  {
    id: 6,
    kind: 'login',
    name: 'Friink Security',
    handle: '@friink',
    text: 'blocked a suspicious login attempt.',
    createdAt: '2026-08-24T08:30:00Z',
    initials: 'FR',
    tone: 'coral',
  },
];

function getIcon(kind: NotificationKind) {
  switch (kind) {
    case 'request':
      return 'fa-user-plus';
    case 'like':
      return 'fa-heart';
    case 'service':
      return 'fa-briefcase';
    case 'reply':
      return 'fa-reply';
    case 'login':
      return 'fa-shield-halved';
    case 'verification':
      return 'fa-badge-check';
    case 'follow':
    default:
      return 'fa-user-group';
  }
}

export function NotificationsScreen() {
  return (
    <PageSurface className="notifications-screen" variant="list">
      <div className="notifications-list">
        {notifications.map((notification) => (
          <ListRow
            key={notification.id}
            avatar={<span className={`user-avatar avatar-${notification.tone}`}>{notification.initials}</span>}
            title={notification.name}
            subtitle={
              <>
                <span className="notification-copy-text">{notification.text}</span>
                <span className="notification-copy-handle">{notification.handle}</span>
              </>
            }
            trailing={
              <span className="notification-meta">
                <i className={`fa-solid ${getIcon(notification.kind)}`} aria-hidden="true" />
                <span>{formatRelativeTime(notification.createdAt)}</span>
              </span>
            }
            unread={notification.unread}
            className="notification-row"
          />
        ))}
      </div>
    </PageSurface>
  );
}
