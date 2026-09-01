import type { ReactNode } from 'react';

type FloatingBarProps = {
  children?: ReactNode;
};

export function FloatingBar({ children }: FloatingBarProps) {
  const hasContextualContent = children !== null && children !== undefined && children !== false;

  return (
    <div className="floating-bar-rail">
      <nav className={`floating-bar${hasContextualContent ? ' floating-bar-contextual' : ''}`} aria-label={hasContextualContent ? 'Contextual actions' : 'Contextual navigation'}>
        {hasContextualContent ? children : null}
      </nav>
    </div>
  );
}
