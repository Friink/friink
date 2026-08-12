import { currentUser, sidebarNavItems, type Screen } from '@/lib/data';

type SideDrawerProps = {
  activeScreen: Screen;
  collapsed: boolean;
  onNavigate: (screen: Screen) => void;
  onToggleCollapsed: () => void;
  onLogout: () => void;
};

export function SideDrawer({ activeScreen, collapsed, onNavigate, onToggleCollapsed, onLogout }: SideDrawerProps) {
  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-header">
        <button
          className="sidebar-menu-button"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
        >
          <i className="fa-solid fa-bars" aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar-profile">
        <span className="user-avatar profile-avatar">
          <img src="/placeholder-avatar.svg" alt="Profile placeholder" />
        </span>
        <div>
          <strong>{currentUser.name}</strong>
          <span>{currentUser.handle}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {sidebarNavItems.map((item) => (
          <button
            className={`nav-item${activeScreen === item.id ? ' active' : ''}`}
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
          >
            <i className={item.icon} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-action" type="button" onClick={() => onNavigate('settings')}>
          <i className="fa-solid fa-gear" aria-hidden="true" />
          <span>Settings</span>
        </button>
        <button className="sidebar-action" type="button" onClick={onLogout}>
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
