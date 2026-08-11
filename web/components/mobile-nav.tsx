import { navItems, type Screen } from '@/lib/data';

type MobileNavProps = {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
};

export function MobileNav({ activeScreen, onNavigate }: MobileNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <button
          className={`bottom-nav-item${activeScreen === item.id ? ' active' : ''}`}
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          aria-label={item.label}
        >
          <i className={item.icon} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
