"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Screen } from '@/lib/data';
import { formatRelativeTime } from '@/lib/time';
import type { NotificationItem } from '@/components/notifications-screen';
import { ContextualDropdown } from '@/components/contextual-dropdown';

type HeaderProps = {
  onNavigate: (screen: Screen) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  notificationCount?: number;
  notifications?: NotificationItem[];
};

export function Header({
  onNavigate,
  sidebarCollapsed,
  onToggleSidebar,
  notificationCount = 0,
  notifications = [],
}: HeaderProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shouldShowNotificationBadge = notificationCount > 0;
  const visibleNotificationCount = notificationCount > 99 ? '99+' : String(notificationCount);
  const recentNotifications = notifications.slice(0, 4);
  const suggestions = searchQuery.trim()
    ? [
        `Posts matching "${searchQuery.trim()}"`,
        `People matching "${searchQuery.trim()}"`,
      ]
    : ['Search people', 'Search posts', 'Search conversations', 'Search hashtags'];

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (searchOpen && !searchRef.current?.contains(target)) {
        setSearchOpen(false);
      }
      if (notificationsOpen && !notificationRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, searchOpen]);

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchOpen(true);
      return;
    }

    setSearchOpen(false);
    router.push(`/search/${encodeURIComponent(trimmedQuery)}`);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  return (
    <header className="topbar">
      <div className="topbar-home">
        <div className="topbar-brand">
          <button
            className="topbar-menu"
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onFocus={(event) => event.stopPropagation()}
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-pressed={sidebarCollapsed}
          >
            <i className="fa-solid fa-bars" aria-hidden="true" />
          </button>
          <a className="topbar-logo-link" href="/home" aria-label="Go to Home">
            <img className="topbar-full-logo" src="/brand/logoFullBrand.svg" alt="Friink" />
          </a>
        </div>
        <div className="topbar-actions">
          <div className={`topbar-search-wrap${searchOpen ? ' topbar-search-wrap-open' : ''}`} ref={searchRef}>
            {searchOpen ? (
              <form className="topbar-search-panel" onSubmit={submitSearch} role="search">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search"
                  aria-label="Search Friink"
                  autoFocus
                />
                <button className="topbar-search-panel-button" type="submit" aria-label="Submit search">
                  <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                </button>
                <button className="topbar-search-panel-button" type="button" onClick={closeSearch} aria-label="Close search">
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <button className="topbar-search" type="button" onClick={() => { setSearchOpen(true); setNotificationsOpen(false); }} aria-label="Search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              </button>
            )}
            {searchOpen ? (
              <ContextualDropdown
                className="topbar-search-dropdown"
                role="listbox"
                ariaLabel="Search suggestions"
                items={suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" role="option" onClick={() => submitSearch()}>
                    <span>{suggestion}</span>
                  </button>
                ))}
                footer={(
                  <button className="topbar-search-open" type="button" onClick={() => { setSearchOpen(false); onNavigate('search'); }}>
                    Open Search
                  </button>
                )}
              />
            ) : null}
          </div>
          <div className="topbar-notification-wrap" ref={notificationRef}>
            <button
              className="topbar-bell"
              type="button"
              onClick={() => { setNotificationsOpen((open) => !open); setSearchOpen(false); }}
              aria-expanded={notificationsOpen}
              aria-label={`${notificationCount} notifications`}
            >
              <i className="fa-regular fa-bell" aria-hidden="true" />
              {shouldShowNotificationBadge ? <span className="topbar-bell-dot" aria-hidden="true" /> : null}
            </button>
            {notificationsOpen ? (
              <ContextualDropdown
                className="topbar-notification-dropdown"
                ariaLabel="Recent notifications"
                items={recentNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    className={`topbar-notification-item${notification.unread ? ' is-unread' : ''}`}
                    type="button"
                    onClick={() => { setNotificationsOpen(false); onNavigate('notifications'); }}
                  >
                    <span className="topbar-notification-item-copy">
                      <strong>{notification.name}</strong>
                      <span>{notification.text}</span>
                    </span>
                    <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                  </button>
                ))}
                footer={(
                  <>
                    {shouldShowNotificationBadge ? <span className="topbar-notification-count">{visibleNotificationCount} new</span> : null}
                    <button className="topbar-notification-all" type="button" onClick={() => { setNotificationsOpen(false); onNavigate('notifications'); }}>
                      All Notifications
                    </button>
                  </>
                )}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
