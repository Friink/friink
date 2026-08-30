import type { ReactNode } from 'react';

type ContextualDropdownProps = {
  ariaLabel: string;
  role?: 'dialog' | 'listbox';
  items: ReactNode[];
  footer?: ReactNode;
  className?: string;
};

export function ContextualDropdown({ ariaLabel, role = 'dialog', items, footer, className = '' }: ContextualDropdownProps) {
  return (
    <div className={`contextual-dropdown${className ? ` ${className}` : ''}`} role={role} aria-label={ariaLabel}>
      <div className="contextual-dropdown-list">
        {items.length > 0 ? items : <div className="contextual-dropdown-empty">Nothing to show.</div>}
      </div>
      {footer ? <div className="contextual-dropdown-footer">{footer}</div> : null}
    </div>
  );
}
