import { sidebarNavItems, type Screen } from '@/lib/data';
import { DEFAULT_PROFILE_IMAGE } from '@/components/profile-card';
import Image from 'next/image';
import type { AuthUser } from '@/lib/auth';
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { getAuthOrigin } from '@/lib/api-origin';
import '@friink/account-switcher';

type SideDrawerProps = {
  user: AuthUser;
  activeScreen: Screen | null;
  collapsed: boolean;
  onNavigate: (screen: Screen) => void;
  onToggleCollapsed: () => void;
  onLogout: (options?: { serverSessionAlreadyEnded?: boolean }) => void | Promise<void>;
};

function AuthAccountSwitcher() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const switcher = document.createElement('account-switcher');
    const authOrigin = getAuthOrigin();
    switcher.setAttribute('auth-url', authOrigin);
    switcher.setAttribute('api-base', `${authOrigin}/api/auth`);
    switcher.setAttribute('variant', 'button');
    host.replaceChildren(switcher);
    const reload = () => window.location.reload();
    window.addEventListener('friink:active-account-changed', reload);
    return () => {
      window.removeEventListener('friink:active-account-changed', reload);
      host.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} className="auth-account-switcher" />;
}

export function SideDrawer({ user, activeScreen, collapsed, onNavigate, onToggleCollapsed, onLogout }: SideDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [hoverExpanded, setHoverExpanded] = useState(false);

  function handleDrawerPointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch' || !window.matchMedia('(min-width: 768px)').matches) return;
    setHoverExpanded(true);
  }

  function handleDrawerPointerLeave() {
    setHoverExpanded(false);
  }

  useEffect(() => {
    const desktopOrTablet = window.matchMedia('(min-width: 768px)');
    const resetMobileHoverExpansion = () => {
      if (desktopOrTablet.matches) return;
      setHoverExpanded(false);
    };

    resetMobileHoverExpansion();
    desktopOrTablet.addEventListener('change', resetMobileHoverExpansion);
    return () => desktopOrTablet.removeEventListener('change', resetMobileHoverExpansion);
  }, []);

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

  function getNavigationHref(screen: Screen) {
    switch (screen) {
      case 'home':
        return '/home/explore';
      case 'profile':
        return `/${encodeURIComponent(user.username)}`;
      case 'connections':
        return `/${encodeURIComponent(user.username)}/connections`;
      case 'saved':
        return '/saved/posts';
      case 'directory':
        return '/directory';
      case 'settings':
        return '/settings/general';
      default:
        return '/home';
    }
  }

  return (
    <aside
      ref={ref}
      className={`sidebar${collapsed && !hoverExpanded ? ' sidebar-collapsed' : ''}${collapsed && hoverExpanded ? ' sidebar-hover-expanded' : ''}`}
      aria-label="Main navigation"
      onPointerEnter={handleDrawerPointerEnter}
      onPointerLeave={handleDrawerPointerLeave}
    >
      <div className="sidebar-profile">
        <a
          className={`nav-item sidebar-profile-link${activeScreen === 'profile' ? ' active' : ''}`}
          href={getNavigationHref('profile')}
          aria-current={activeScreen === 'profile' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            handleNavigate('profile');
          }}
        >
            <span className="nav-item-icon sidebar-profile-avatar" aria-hidden="true">
              <span className="user-avatar avatar-mint profile-card-avatar-image">
                <Image src={user.profilePictureUrl || DEFAULT_PROFILE_IMAGE} alt="" width={20} height={20} sizes="20px" unoptimized />
              </span>
          </span>
          <span className="sidebar-profile-label">@{user.username}</span>
        </a>
        <AuthAccountSwitcher />
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {sidebarNavItems.map((item) => (
          <a
            className={`nav-item${activeScreen === item.id ? ' active' : ''}`}
            key={item.id}
            href={getNavigationHref(item.id)}
            aria-current={activeScreen === item.id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              handleNavigate(item.id);
            }}
          >
            <span className="nav-item-icon" aria-hidden="true">
              <i className={item.icon} />
            </span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user.isStaff ? <a className="sidebar-action" href="/cp">
          <span className="nav-item-icon" aria-hidden="true"><i className="fa-solid fa-shield-halved" /></span>
          <span>Control panel</span>
        </a> : null}
        <a
          className="sidebar-action"
          href={getNavigationHref('settings')}
          onClick={(event) => {
            event.preventDefault();
            handleNavigate('settings');
          }}
        >
          <span className="nav-item-icon" aria-hidden="true">
            <i className="fa-solid fa-gear" />
          </span>
          <span>Settings</span>
        </a>
        <button className="sidebar-action" type="button" onClick={() => onLogout()}>
          <span className="nav-item-icon" aria-hidden="true">
            <i className="fa-solid fa-right-from-bracket" />
          </span>
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
