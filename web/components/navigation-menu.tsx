"use client";

type NavigationMenuProps = {
  open: boolean;
};

const dummyMenuItems = [
  { label: 'Share profile', icon: 'fa-share-nodes' },
  { label: 'Copy link', icon: 'fa-link' },
  { label: 'Mute updates', icon: 'fa-bell-slash' },
  { label: 'Report', icon: 'fa-flag' },
];

export function NavigationMenu({ open }: NavigationMenuProps) {
  if (!open) return null;

  return (
    <div className="navigation-menu" role="menu" aria-label="More options">
      {dummyMenuItems.map((item) => (
        <button className="navigation-menu-item" type="button" role="menuitem" key={item.label}>
          <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
