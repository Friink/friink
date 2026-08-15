"use client";

import { useEffect, useRef } from 'react';
import { sidebarNavItems, type Screen } from '@/lib/data';
import type { AuthUser } from '@/lib/auth';

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
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Only attach outside-click collapse behavior on small screens (mobile).
    if (typeof window === 'undefined') return;
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    if (!mobileQuery.matches) return;

    function handlePointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      // if already collapsed, nothing to do
      if (collapsed) return;
      const target = e.target as Node | null;
      if (target && !containerRef.current.contains(target)) {
        onToggleCollapsed();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [collapsed, onToggleCollapsed]);

  return (
    <aside ref={containerRef} className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} aria-label="Main navigation">
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
        <span className="user-avatar profile-avatar">{getInitials(user.name)}</span>
        <div>
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
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
