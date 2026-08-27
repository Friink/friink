import type { ReactNode } from 'react';
import { navItems, type Screen } from '@/lib/data';

type FloatingBarProps = {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  children?: ReactNode;
};

export function FloatingBar({ activeScreen, onNavigate, children }: FloatingBarProps) {
  const hasContextualContent = children !== null && children !== undefined && children !== false;

  return (
    <nav className={`floating-bar${hasContextualContent ? ' floating-bar-contextual' : ''}`} aria-label={hasContextualContent ? 'Contextual actions' : 'Contextual navigation'}>
      {hasContextualContent ? children : navItems.filter((item) => item.id === 'post').map((item) => (
        <button
          className={`floating-bar-item${activeScreen === item.id ? ' active' : ''}`}
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          aria-label={item.id === 'post' ? 'Create post' : item.label}
        >
          <i className={item.icon} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
