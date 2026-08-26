type NavigationBarProps = {
  title: string;
  onBack?: () => void;
  backDisabled?: boolean;
  onMenu?: () => void;
};

export function NavigationBar({ title, onBack, backDisabled = false, onMenu }: NavigationBarProps) {
  return (
    <div className="navigationbar" aria-label={`${title} navigation`}>
      <div className="navigationbar-left">
        <button className="navigationbar-button navigationbar-back" type="button" onClick={onBack} disabled={backDisabled} aria-label="Go back">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </button>

        <div className="navigationbar-title">{title}</div>
      </div>

      <button className="navigationbar-button navigationbar-menu" type="button" onClick={onMenu} aria-label="More options">
        <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
      </button>
    </div>
  );
}
