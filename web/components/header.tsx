import type { Screen } from '@/lib/data';

type HeaderProps = {
  onNavigate: (screen: Screen) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export function Header({
  onNavigate,
  sidebarCollapsed,
  onToggleSidebar,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-home">
        <div className="topbar-brand">
          <button
            className="topbar-menu"
            type="button"
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
          <button className="topbar-bell" type="button" onClick={() => onNavigate('notifications')} aria-label="Notifications">
            <i className="fa-regular fa-bell" aria-hidden="true" />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
