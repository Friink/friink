'use client';

import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { formatRelativeTime } from '@/lib/time';

type NotificationKind = 'request' | 'like' | 'service' | 'reply' | 'login' | 'verification' | 'follow';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  name: string;
  handle: string;
  text: string;
  createdAt: string;
  initials: string;
  tone: 'coral' | 'sage' | 'sun' | 'mint';
  unread?: boolean;
};

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

type NotificationsScreenProps = {
  notifications?: NotificationItem[];
};

export function NotificationsScreen({ notifications = [] }: NotificationsScreenProps) {
  return (
    <PageSurface className="notifications-screen" variant="list">
      <div className="notifications-list">
        {notifications.length > 0 ? notifications.map((notification) => (
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
        )) : (
          <div className="connections-empty">
            <i className="fa-solid fa-bell" aria-hidden="true" />
            <p>No notifications yet.</p>
            <span>Follow activity and requests will appear here.</span>
          </div>
        )}
      </div>
    </PageSurface>
  );
}
