"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import type { Screen } from '@/lib/data';
import { ContextualDropdown } from '@/components/contextual-dropdown';
import type { NotificationItem } from '@/components/notifications-screen';
import { formatRelativeTime } from '@/lib/time';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Modal } from '@/components/modal';

type TopBarProps = {
  title: string;
  sidebarCollapsed: boolean;
  notificationCount?: number;
  hasUnreadMessages?: boolean;
  notifications?: NotificationItem[];
  isHome?: boolean;
  isSearchPage?: boolean;
  initialSearchQuery?: string;
  searchFilter?: 'all' | 'people' | 'posts' | 'messages';
  searchScope?: 'global' | 'messages';
  backDisabled?: boolean;
  menuItems?: ActionMenuItem[];
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onToggleSidebar: () => void;
};

export function TopBar({ title, sidebarCollapsed, notificationCount = 0, hasUnreadMessages = false, notifications = [], isHome = false, isSearchPage = false, initialSearchQuery = '', searchFilter = 'all', searchScope = 'global', backDisabled = false, menuItems = [], onNavigate, onBack, onToggleSidebar }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  const [searchSort, setSearchSort] = useState('relevance');
  const [searchDate, setSearchDate] = useState('any');
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const unreadNotifications = notifications.filter((notification) => notification.unread);
  const suggestions = searchQuery.trim()
    ? [`Posts matching "${searchQuery.trim()}"`, `People matching "${searchQuery.trim()}"`]
    : ['Search people', 'Search posts', 'Search conversations', 'Search hashtags'];

  useEffect(() => {
    if (isSearchPage) setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery, isSearchPage]);

  useEffect(() => {
    if (!isSearchPage) return;
    const sort = currentSearchParams.get('sort');
    const date = currentSearchParams.get('date');
    setSearchSort(searchFilter === 'people' ? 'relevance' : sort === 'newest' || sort === 'oldest' ? sort : 'relevance');
    setSearchDate(searchFilter === 'posts' || searchFilter === 'messages' ? date === 'day' || date === 'week' || date === 'month' || date === 'custom' ? date : 'any' : 'any');
    setSearchDateFrom(currentSearchParams.get('date_from') ?? '');
    setSearchDateTo(currentSearchParams.get('date_to') ?? '');
  }, [currentSearchParams, isSearchPage, searchFilter]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (searchOpen && !searchRef.current?.contains(target)) setSearchOpen(false);
      if (notificationsOpen && !notificationRef.current?.contains(target)) setNotificationsOpen(false);
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

  useEffect(() => {
    if (!notificationsOpen) return;

    const updateNotificationDropdownGeometry = () => {
      const notificationSurface = notificationRef.current;
      const dropdown = notificationSurface?.querySelector<HTMLElement>('.topbar-preview-notification-dropdown');
      const list = dropdown?.querySelector<HTMLElement>('.contextual-dropdown-list');
      if (!notificationSurface || !dropdown || !list) return;
      notificationSurface.style.setProperty('--topbar-notification-dropdown-top', `${dropdown.getBoundingClientRect().top}px`);

      const items = Array.from(list.querySelectorAll<HTMLElement>('.topbar-notification-item'));
      if (items.length > 8) {
        const listTop = list.getBoundingClientRect().top;
        const ninthItemTop = items[8].getBoundingClientRect().top;
        list.style.setProperty('--topbar-notification-visible-height', `${Math.max(0, ninthItemTop - listTop)}px`);
      } else {
        list.style.removeProperty('--topbar-notification-visible-height');
      }
    };

    const frame = window.requestAnimationFrame(updateNotificationDropdownGeometry);
    const resizeObserver = new ResizeObserver(updateNotificationDropdownGeometry);
    if (notificationRef.current) resizeObserver.observe(notificationRef.current);
    window.addEventListener('resize', updateNotificationDropdownGeometry);
    window.visualViewport?.addEventListener('resize', updateNotificationDropdownGeometry);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateNotificationDropdownGeometry);
      window.visualViewport?.removeEventListener('resize', updateNotificationDropdownGeometry);
      notificationRef.current?.style.removeProperty('--topbar-notification-dropdown-top');
    };
  }, [notificationsOpen]);

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSearchOpen(false);
    const scopeSuffix = searchScope === 'messages' ? '?scope=messages' : '';
    router.push(`/search/${encodeURIComponent(query)}${scopeSuffix}`);
  }

  const searchControl = (
    <div className={`topbar-preview-search${searchOpen || isSearchPage ? ' is-open' : ''}`} ref={searchRef}>
      {searchOpen || isSearchPage ? (
        <form className="topbar-preview-search-panel" onSubmit={submitSearch} role="search">
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search" aria-label="Search Friink" autoFocus={isSearchPage} />
          <button className="topbar-preview-search-button" type="submit" aria-label="Submit search"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /></button>
          {!isSearchPage ? <button className="topbar-preview-search-button" type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label="Close search"><i className="fa-solid fa-xmark" aria-hidden="true" /></button> : null}
        </form>
      ) : (
        <button className="topbar-preview-action" type="button" onClick={() => { setSearchOpen(true); setNotificationsOpen(false); }} aria-label="Search" title="Search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        </button>
      )}
      {searchOpen ? <ContextualDropdown className="topbar-preview-search-dropdown" role="listbox" ariaLabel="Search suggestions" items={suggestions.map((suggestion) => <button key={suggestion} type="button" role="option" onClick={() => submitSearch()}><span>{suggestion}</span></button>)} footer={<button className="topbar-notification-all" type="button" onClick={() => { setSearchOpen(false); onNavigate('search'); }}>Open Search</button>} /> : null}
    </div>
  );

  const dateFilterAvailable = searchFilter === 'posts' || searchFilter === 'messages';
  const searchFiltersActive = searchSort !== 'relevance' || (dateFilterAvailable && searchDate !== 'any');
  const applySearchFilters = () => {
    const nextParams = new URLSearchParams(currentSearchParams.toString());
    if (searchSort === 'relevance' || searchFilter === 'people') nextParams.delete('sort');
    else nextParams.set('sort', searchSort);
    if (!dateFilterAvailable || searchDate === 'any') {
      nextParams.delete('date');
      nextParams.delete('date_from');
      nextParams.delete('date_to');
    } else {
      nextParams.set('date', searchDate);
      if (searchDate === 'custom') {
        nextParams.set('date_from', searchDateFrom);
        nextParams.set('date_to', searchDateTo);
      } else {
        nextParams.delete('date_from');
        nextParams.delete('date_to');
      }
    }
    const suffix = nextParams.toString() ? `?${nextParams.toString()}` : '';
    router.replace(`${pathname}${suffix}`, { scroll: false });
    setSearchFiltersOpen(false);
  };

  const searchFiltersModal = searchFiltersOpen ? (
    <Modal
      title="Sort and filter"
      closeLabel="Close sort and filter"
      onClose={() => setSearchFiltersOpen(false)}
      className="search-filters-modal"
      actions={<><button className="button-secondary" type="button" onClick={() => { setSearchSort('relevance'); setSearchDate('any'); setSearchDateFrom(''); setSearchDateTo(''); }}>Reset</button><button className="button-primary" type="button" onClick={applySearchFilters} disabled={searchDate === 'custom' && (!searchDateFrom || !searchDateTo || searchDateFrom > searchDateTo)}>Apply</button></>}
    >
      <div className="search-filters-form">
        <div className="search-filter-group">
          <label className="settings-field-label" htmlFor="search-sort">Sort by</label>
          <select id="search-sort" className="settings-field-input" value={searchSort} onChange={(event) => setSearchSort(event.target.value)}>
            <option value="relevance">Most relevant</option>
            {searchFilter !== 'people' ? <><option value="newest">Newest</option><option value="oldest">Oldest</option></> : null}
          </select>
        </div>
        {dateFilterAvailable ? <div className="search-filter-group">
          <label className="settings-field-label" htmlFor="search-date">Date</label>
          <select id="search-date" className="settings-field-input" value={searchDate} onChange={(event) => setSearchDate(event.target.value)}>
            <option value="any">Any time</option>
            <option value="day">Past 24 hours</option>
            <option value="week">Past 7 days</option>
            <option value="month">Past 30 days</option>
            <option value="custom">Custom range</option>
          </select>
          {searchDate === 'custom' ? <div className="search-filter-date-range"><div><label className="settings-field-label" htmlFor="search-date-from">From</label><input id="search-date-from" className="settings-field-input" type="date" value={searchDateFrom} onChange={(event) => setSearchDateFrom(event.target.value)} /></div><div><label className="settings-field-label" htmlFor="search-date-to">To</label><input id="search-date-to" className="settings-field-input" type="date" min={searchDateFrom || undefined} value={searchDateTo} onChange={(event) => setSearchDateTo(event.target.value)} /></div></div> : null}
        </div> : null}
      </div>
    </Modal>
  ) : null;

  return (
    <header className={`topbar-preview${isHome ? '' : ' topbar-preview-contextual'}${isSearchPage ? ' topbar-preview-search-route' : ''}`} aria-label="Unified application top bar">
      <div className="topbar-preview-inner">
        <div className={`topbar-preview-leading${isHome ? '' : ' topbar-preview-contextual-leading'}`}>
          {isHome ? (
            <button className="topbar-preview-menu" type="button" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-pressed={sidebarCollapsed}>
              <i className="fa-solid fa-bars" aria-hidden="true" />
            </button>
          ) : (
            <button className="topbar-preview-back" type="button" onClick={onBack} disabled={backDisabled} aria-label="Go back">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            </button>
          )}
          {!isSearchPage ? <a className="topbar-preview-logo" href="/home" aria-label="Go to Home">
            <img className="topbar-preview-logo-light" src="/brand/logoBlack.svg" alt="Friink" />
            <img className="topbar-preview-logo-dark" src="/brand/logoWhite.svg" alt="" aria-hidden="true" />
          </a> : null}
        </div>

        <div className="topbar-preview-context" aria-live="polite">{isSearchPage ? searchControl : <strong>{title}</strong>}</div>

        {isHome ? (
          <nav className="topbar-preview-actions" aria-label="Global actions">
            {searchControl}
            <a className="topbar-preview-action" href="/chats" onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate('messages'); }} aria-label={hasUnreadMessages ? 'Chat, new message' : 'Chat'} title="Chat">
              <i className="fa-regular fa-envelope" aria-hidden="true" />
              {hasUnreadMessages ? <span className="topbar-preview-dot topbar-preview-message-dot" aria-hidden="true" /> : null}
            </a>
            <div className="topbar-preview-notifications" ref={notificationRef}>
              <button className="topbar-preview-action" type="button" onClick={() => { setNotificationsOpen((open) => !open); setSearchOpen(false); }} aria-expanded={notificationsOpen} aria-label={`${notificationCount} notifications`} title="Notifications">
                <i className="fa-regular fa-bell" aria-hidden="true" />
                {notificationCount > 0 ? <span className="topbar-preview-dot topbar-preview-notification-dot" aria-hidden="true" /> : null}
              </button>
              {notificationsOpen ? <ContextualDropdown className="topbar-preview-notification-dropdown" ariaLabel="Recent notifications" items={unreadNotifications.map((notification) => <div key={notification.id} className="topbar-notification-item is-unread"><button className="topbar-notification-item-button" type="button" onClick={() => { setNotificationsOpen(false); if (notification.href) router.push(notification.href); else onNavigate('notifications'); }}><span className="topbar-notification-item-copy"><strong>{notification.name}</strong><span>{notification.text}</span></span><time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time></button></div>)} footer={<button className="topbar-notification-all" type="button" onClick={() => { setNotificationsOpen(false); onNavigate('notifications'); }}>All Notifications</button>} /> : null}
            </div>
          </nav>
        ) : (
          <div className="topbar-preview-contextual-actions">
            {!isSearchPage ? searchControl : null}
            {isSearchPage ? <button className="topbar-preview-action" type="button" onClick={() => { setSearchFiltersOpen(true); setMenuOpen(false); }} aria-label="Sort and filter search results" aria-haspopup="dialog" aria-expanded={searchFiltersOpen} title="Sort and filter">
              <i className="fa-solid fa-filter" aria-hidden="true" />
              {searchFiltersActive ? <span className="topbar-preview-dot" aria-hidden="true" /> : null}
            </button> : null}
            <button ref={menuButtonRef} className="topbar-preview-action" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="More options" aria-expanded={menuOpen} title="More options">
              <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
            </button>
            <ActionMenu open={menuOpen} anchorRef={menuButtonRef} items={menuItems} onClose={() => setMenuOpen(false)} />
          </div>
        )}
      </div>
      {searchFiltersModal}
    </header>
  );
}
