'use client';

import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import { formatRelativeTime } from '@/lib/time';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

type NotificationKind = 'request' | 'like' | 'service' | 'reply' | 'login' | 'verification' | 'follow' | 'mention' | 'chat';

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
  href?: string;
  actions?: NotificationAction[];
};

export type NotificationAction = {
  label: string;
  onClick: () => void;
  busy?: boolean;
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
    case 'mention':
      return 'fa-at';
    case 'chat':
      return 'fa-message';
    case 'follow':
    default:
      return 'fa-user-group';
  }
}

function profileHref(handle: string) {
  return `/${handle.replace('@', '')}`;
}

type NotificationsScreenProps = {
  notifications?: NotificationItem[];
  onMarkRead?: (notificationId: string) => void;
  emptyMessage?: string;
};

export function NotificationsScreen({ notifications = [], onMarkRead, emptyMessage = 'No notifications yet.' }: NotificationsScreenProps) {
  const markedVisible = useRef(new Set<string>());
  const visibleIds = useRef(new Set<string>());
  const hasScrolled = useRef(false);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const timers: number[] = [];
    const pendingIds = new Set<string>();
    const nodes = document.querySelectorAll<HTMLElement>('[data-notification-id]');
    nodes.forEach((node) => {
      const id = node.dataset.notificationId;
      if (!id || markedVisible.current.has(id)) return;
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) {
          visibleIds.current.delete(id);
          return;
        }
        visibleIds.current.add(id);
        if (!hasScrolled.current || markedVisible.current.has(id) || pendingIds.has(id)) return;
        pendingIds.add(id);
        const timer = window.setTimeout(() => {
          markedVisible.current.add(id);
          pendingIds.delete(id);
          onMarkRead?.(id);
        }, 700);
        timers.push(timer);
      }, { threshold: 0.6 });
      observer.observe(node);
      observers.push(observer);
    });
    const markScrolledIntoView = () => {
      hasScrolled.current = true;
      visibleIds.current.forEach((id) => {
        if (markedVisible.current.has(id) || pendingIds.has(id)) return;
        pendingIds.add(id);
        const timer = window.setTimeout(() => {
          markedVisible.current.add(id);
          pendingIds.delete(id);
          onMarkRead?.(id);
        }, 700);
        timers.push(timer);
      });
    };
    document.addEventListener('scroll', markScrolledIntoView, { passive: true, capture: true });
    return () => {
      observers.forEach((observer) => observer.disconnect());
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener('scroll', markScrolledIntoView, true);
    };
  }, [notifications, onMarkRead]);

  return (
    <PageSurface className="notifications-screen" variant="list">
      <div className="notifications-list">
        {notifications.length > 0 ? notifications.map((notification) => (
          <div key={notification.id} data-notification-id={notification.id}>
            <ListRow
              title={
                <ProfileCard
                  name={notification.name}
                  handle={notification.handle}
                  tone={notification.tone}
                  initials={notification.initials}
                  href={profileHref(notification.handle)}
                />
              }
              subtitle={
                notification.href ? (
                  <Link className="notification-copy-text notification-post-link" href={notification.href}>
                    {notification.text}
                  </Link>
                ) : <span className="notification-copy-text">{notification.text}</span>
              }
              trailing={
                <span className="notification-meta">
                  <i className={`fa-solid ${getIcon(notification.kind)}`} aria-hidden="true" />
                  <span>{formatRelativeTime(notification.createdAt)}</span>
                  {notification.actions?.length ? (
                    <span className="notification-actions">
                      {notification.actions.map((action) => (
                        <button key={action.label} className="text-link" type="button" onClick={(event) => { event.stopPropagation(); action.onClick(); }} disabled={action.busy}>
                          {action.busy ? 'Working…' : action.label}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </span>
              }
              unread={notification.unread}
              className="notification-row"
            />
          </div>
        )) : (
          <div className="connections-empty">
            <i className="fa-solid fa-bell" aria-hidden="true" />
            <p>{emptyMessage}</p>
            <span>Follow activity and requests will appear here.</span>
          </div>
        )}
      </div>
    </PageSurface>
  );
}
