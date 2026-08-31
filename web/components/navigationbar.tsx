"use client";

import { useEffect, useRef, useState } from 'react';
import { ActionMenu } from '@/components/action-menu';

type NavigationBarProps = {
  title: string;
  onBack?: () => void;
  backDisabled?: boolean;
};

export function NavigationBar({ title, onBack, backDisabled = false }: NavigationBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="navigationbar" aria-label={`${title} navigation`}>
      <div className="navigationbar-left">
        <button className="navigationbar-button navigationbar-back" type="button" onClick={onBack} disabled={backDisabled} aria-label="Go back">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </button>

        <div className="navigationbar-title">{title}</div>
      </div>

      <div className="navigationbar-menu-wrap" ref={menuRef}>
        <button
          className="navigationbar-button navigationbar-menu"
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
        </button>
        <ActionMenu open={menuOpen} />
      </div>
    </div>
  );
}
