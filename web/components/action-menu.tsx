"use client";

export type ActionMenuItem = {
  label: string;
  icon: string;
  onClick?: () => void;
};

type ActionMenuProps = {
  open: boolean;
  items?: ActionMenuItem[];
  ariaLabel?: string;
};

const defaultMenuItems: ActionMenuItem[] = [
  { label: 'Share profile', icon: 'fa-share-nodes' },
  { label: 'Copy link', icon: 'fa-link' },
  { label: 'Mute updates', icon: 'fa-bell-slash' },
  { label: 'Report', icon: 'fa-flag' },
];

export function ActionMenu({ open, items = defaultMenuItems, ariaLabel = 'More options' }: ActionMenuProps) {
  if (!open) return null;

  return (
    <div className="action-menu" role="menu" aria-label={ariaLabel}>
      {items.map((item) => (
        <button className="action-menu-item" type="button" role="menuitem" key={item.label} onClick={item.onClick}>
          <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
