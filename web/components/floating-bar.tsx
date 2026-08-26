import { navItems, type Screen } from '@/lib/data';

type FloatingBarProps = {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
};

export function FloatingBar({ activeScreen, onNavigate }: FloatingBarProps) {
  return (
    <nav className="floating-bar" aria-label="Contextual navigation">
      {navItems.filter((item) => item.id !== 'search' && item.id !== 'connections').map((item) => (
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
