import type { Screen } from '@/lib/data';

type HeaderProps = {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
};

export function Header({ activeScreen, onNavigate }: HeaderProps) {
  const pageTitles: Partial<Record<Screen, string>> = {
    home: 'Home',
    connections: 'Connections',
    profile: 'Profile',
    starred: 'Starred',
    settings: 'Settings',
  };

  return (
    <header className="topbar">
      <div className="topbar-home">
        {pageTitles[activeScreen] && <h1>{pageTitles[activeScreen]}</h1>}
        <div className="topbar-actions">
          <button className="topbar-search" type="button" onClick={() => onNavigate('search')} aria-label="Search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </button>
        <button className="topbar-bell" type="button" aria-label="Notifications">
          <i className="fa-regular fa-bell" aria-hidden="true" />
          <span />
        </button>
        </div>
      </div>
    </header>
  );
}
