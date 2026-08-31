"use client";

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';

export type ActionMenuItem = {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
};

type ActionMenuProps = {
  open: boolean;
  items?: ActionMenuItem[];
  header?: ReactNode;
  ariaLabel?: string;
  anchorRef: RefObject<HTMLElement>;
  align?: 'start' | 'end';
  anchorGap?: number;
  className?: string;
  onClose?: () => void;
};

const defaultMenuItems: ActionMenuItem[] = [
  { label: 'Share profile', icon: 'fa-share-nodes' },
  { label: 'Copy link', icon: 'fa-link' },
  { label: 'Mute updates', icon: 'fa-bell-slash' },
  { label: 'Report', icon: 'fa-flag' },
];

type MenuPosition = {
  top: number;
  left: number;
  ready: boolean;
};

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 7;

export function ActionMenu({ open, items = defaultMenuItems, header, ariaLabel = 'More options', anchorRef, align = 'end', anchorGap = ANCHOR_GAP, className = '', onClose }: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !menuRef.current) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - menuRect.width - VIEWPORT_MARGIN);
      const preferredLeft = align === 'start' ? anchorRect.left : anchorRect.right - menuRect.width;
      const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = window.innerHeight - anchorRect.bottom - anchorGap - VIEWPORT_MARGIN;
      const spaceAbove = anchorRect.top - anchorGap - VIEWPORT_MARGIN;
      const opensAbove = spaceBelow < menuRect.height && spaceAbove > spaceBelow;
      const preferredTop = opensAbove ? anchorRect.top - anchorGap - menuRect.height : anchorRect.bottom + anchorGap;
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - menuRect.height - VIEWPORT_MARGIN);
      const top = Math.min(Math.max(preferredTop, VIEWPORT_MARGIN), maxTop);

      setPosition({ top, left, ready: true });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorGap, anchorRef, open]);

  useLayoutEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
        onClose?.();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`action-menu${className ? ` ${className}` : ''}`}
      role="menu"
      aria-label={ariaLabel}
      style={{ top: position.top, left: position.left, visibility: position.ready ? 'visible' : 'hidden' }}
    >
      {header}
      {items.map((item) => (
        item.href ? (
          <Link
            className="action-menu-item"
            role="menuitem"
            href={item.href}
            key={item.label}
            onClick={() => {
              item.onClick?.();
              onClose?.();
            }}
          >
            <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ) : (
          <button
            className="action-menu-item"
            type="button"
            role="menuitem"
            key={item.label}
            onClick={() => {
              item.onClick?.();
              onClose?.();
            }}
          >
            <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        )
      ))}
    </div>,
    document.body,
  );
}
