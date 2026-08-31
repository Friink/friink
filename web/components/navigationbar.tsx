"use client";

import { useRef, useState } from 'react';
import { ActionMenu } from '@/components/action-menu';

type NavigationBarProps = {
  title: string;
  onBack?: () => void;
  backDisabled?: boolean;
};

export function NavigationBar({ title, onBack, backDisabled = false }: NavigationBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="navigationbar" aria-label={`${title} navigation`}>
      <div className="navigationbar-left">
        <button className="navigationbar-button navigationbar-back" type="button" onClick={onBack} disabled={backDisabled} aria-label="Go back">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </button>

        <div className="navigationbar-title">{title}</div>
      </div>

      <div className="navigationbar-menu-wrap">
        <button
          ref={menuButtonRef}
          className="navigationbar-button navigationbar-menu"
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
        </button>
        <ActionMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} />
      </div>
    </div>
  );
}
