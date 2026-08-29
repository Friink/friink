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
  const shouldShowNotificationBadge = notificationCount > 0;
  const visibleNotificationCount = notificationCount > 99 ? '99+' : String(notificationCount);

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
          <button className="topbar-search" type="button" onClick={() => onNavigate('search')} aria-label="Search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </button>
          <button className="topbar-bell" type="button" onClick={() => onNavigate('notifications')} aria-label={`${visibleNotificationCount} notifications`}>
            <i className="fa-regular fa-bell" aria-hidden="true" />
            {shouldShowNotificationBadge ? <span>{visibleNotificationCount}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
