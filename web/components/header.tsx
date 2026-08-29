"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Screen } from '@/lib/data';

type HeaderProps = {
  onNavigate: (screen: Screen) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  notificationCount?: number;
};

export function Header({
  onNavigate,
  sidebarCollapsed,
  onToggleSidebar,
  notificationCount = 0,
}: HeaderProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shouldShowNotificationBadge = notificationCount > 0;
  const visibleNotificationCount = notificationCount > 99 ? '99+' : String(notificationCount);
  const suggestions = searchQuery.trim()
    ? [
        `Posts matching "${searchQuery.trim()}"`,
        `People matching "${searchQuery.trim()}"`,
      ]
    : ['Search people', 'Search posts', 'Search conversations'];

  useEffect(() => {
    if (!searchOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchOpen]);

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
          <img className="topbar-full-logo" src="/brand/logoFullBrand.svg" alt="Friink" />
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
              </form>
            ) : (
              <button className="topbar-search" type="button" onClick={() => setSearchOpen(true)} aria-label="Search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              </button>
            )}
            {searchOpen ? (
              <div className="topbar-search-dropdown" role="listbox" aria-label="Search suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" role="option" onClick={() => submitSearch()}>
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button className="topbar-bell" type="button" onClick={() => onNavigate('notifications')} aria-label={`${visibleNotificationCount} notifications`}>
            <i className="fa-regular fa-bell" aria-hidden="true" />
            {shouldShowNotificationBadge ? <span>{visibleNotificationCount}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
