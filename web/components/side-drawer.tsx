import { sidebarNavItems, type Screen } from '@/lib/data';
import { ProfileCard } from '@/components/profile-card';
import type { AuthUser } from '@/lib/auth';
import { useEffect, useRef } from 'react';

type SideDrawerProps = {
  user: AuthUser;
  activeScreen: Screen;
  collapsed: boolean;
  onNavigate: (screen: Screen) => void;
  onToggleCollapsed: () => void;
  onLogout: () => void;
};

function getInitials(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}

export function SideDrawer({ user, activeScreen, collapsed, onNavigate, onToggleCollapsed, onLogout }: SideDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleOutside(e: Event) {
      if (collapsed) return;
      try {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (!isMobile) return;
        const target = e.target as Node | null;
        if (ref.current && target && !ref.current.contains(target)) {
          onToggleCollapsed();
        }
      } catch (err) {
        // ignore
      }
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('focusin', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('focusin', handleOutside);
    };
  }, [collapsed, onToggleCollapsed]);

  function handleNavigate(screen: Screen) {
    onNavigate(screen);

    try {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (isMobile && !collapsed) {
        onToggleCollapsed();
      }
    } catch (err) {
      // ignore
    }
  }

  return (
    <aside ref={ref} className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-profile">
        <ProfileCard name={user.name} handle={`@${user.username}`} tone="mint" initials={getInitials(user.name)} imageUrl={user.profilePictureUrl} />
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {sidebarNavItems.map((item) => (
          <button
            className={`nav-item${activeScreen === item.id ? ' active' : ''}`}
            key={item.id}
            type="button"
            onClick={() => handleNavigate(item.id)}
          >
            <span className="nav-item-icon" aria-hidden="true">
              <i className={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-action" type="button" onClick={() => handleNavigate('settings')}>
          <span className="nav-item-icon" aria-hidden="true">
            <i className="fa-solid fa-gear" />
          </span>
          <span>Settings</span>
        </button>
        <button className="sidebar-action" type="button" onClick={onLogout}>
          <span className="nav-item-icon" aria-hidden="true">
            <i className="fa-solid fa-right-from-bracket" />
          </span>
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
