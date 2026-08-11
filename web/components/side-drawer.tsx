import { FriinkLogo } from '@/components/friink-logo';
import { currentUser, navItems, type Screen } from '@/lib/data';

type SideDrawerProps = {
  activeScreen: Screen;
  collapsed: boolean;
  onNavigate: (screen: Screen) => void;
  onToggleCollapsed: () => void;
  onLogout: () => void;
};

function UserAvatar({ initials, tone }: { initials: string; tone: string }) {
  return <span className={`user-avatar avatar-${tone}`}>{initials}</span>;
}

export function SideDrawer({ activeScreen, collapsed, onNavigate, onToggleCollapsed, onLogout }: SideDrawerProps) {
  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <FriinkLogo />
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
        {navItems.map((item) => (
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
        <button
          className="sidebar-action sidebar-collapse-button"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
        >
          <i className="fa-solid fa-bars" aria-hidden="true" />
          <span>{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
        <button className="sidebar-action" type="button" onClick={onLogout}>
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
