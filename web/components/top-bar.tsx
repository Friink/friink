"use client";

import { useRef, useState } from 'react';
import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import type { Screen } from '@/lib/data';

type TopBarProps = {
  title: string;
  sidebarCollapsed: boolean;
  notificationCount?: number;
  hasUnreadMessages?: boolean;
  isHome?: boolean;
  backDisabled?: boolean;
  menuItems?: ActionMenuItem[];
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onToggleSidebar: () => void;
};

export function TopBar({ title, sidebarCollapsed, notificationCount = 0, hasUnreadMessages = false, isHome = false, backDisabled = false, menuItems = [], onNavigate, onBack, onToggleSidebar }: TopBarProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`topbar-preview${isHome ? '' : ' topbar-preview-contextual'}`} aria-label="Unified application top bar">
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
          <a className="topbar-preview-logo" href="/home" aria-label="Go to Home">
            <img className="topbar-preview-logo-light" src="/brand/logoBlack.svg" alt="Friink" />
            <img className="topbar-preview-logo-dark" src="/brand/logoWhite.svg" alt="" aria-hidden="true" />
          </a>
        </div>

        <div className="topbar-preview-context" aria-live="polite"><strong>{title}</strong></div>

        {isHome ? (
          <nav className="topbar-preview-actions" aria-label="Global actions">
            <button className="topbar-preview-action" type="button" onClick={() => onNavigate('search')} aria-label="Search" title="Search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            </button>
            <a className="topbar-preview-action" href="/chats" onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate('messages'); }} aria-label={hasUnreadMessages ? 'Chat, new message' : 'Chat'} title="Chat">
              <i className="fa-regular fa-envelope" aria-hidden="true" />
              {hasUnreadMessages ? <span className="topbar-preview-dot" aria-hidden="true" /> : null}
            </a>
            <a className="topbar-preview-action" href="/notifications" onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate('notifications'); }} aria-label={`${notificationCount} notifications`} title="Notifications">
              <i className="fa-regular fa-bell" aria-hidden="true" />
              {notificationCount > 0 ? <span className="topbar-preview-dot" aria-hidden="true" /> : null}
            </a>
          </nav>
        ) : (
          <div className="topbar-preview-contextual-actions">
            <button ref={menuButtonRef} className="topbar-preview-action" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="More options" aria-expanded={menuOpen} title="More options">
              <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
            </button>
            <ActionMenu open={menuOpen} anchorRef={menuButtonRef} items={menuItems} onClose={() => setMenuOpen(false)} />
          </div>
        )}
      </div>
    </header>
  );
}
