type NavigationBarProps = {
  title: string;
  onBack?: () => void;
  onMenu?: () => void;
};

export function NavigationBar({ title, onBack, onMenu }: NavigationBarProps) {
  return (
    <div className="navigationbar" aria-label={`${title} navigation`}>
      <button className="navigationbar-button navigationbar-back" type="button" onClick={onBack} aria-label="Go back">
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
      </button>

      <div className="navigationbar-title">{title}</div>

      <button className="navigationbar-button navigationbar-menu" type="button" onClick={onMenu} aria-label="More options">
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
    </div>
  );
}
