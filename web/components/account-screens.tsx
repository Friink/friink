export type AppearanceMode = 'system' | 'light' | 'dark';

type SettingsScreenProps = {
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
};

export function SettingsScreen({ appearance, onAppearanceChange }: SettingsScreenProps) {
  return (
    <section className="simple-screen">
      <i className="fa-solid fa-gear" aria-hidden="true" />
      <h2>Settings</h2>
      <p>Manage your Friink preferences.</p>

      <div className="settings-preference">
        <div>
          <h3>Appearance</h3>
          <p>Choose how Friink looks on this device.</p>
        </div>
        <div className="appearance-toggle" role="group" aria-label="Appearance preference">
          {(['system', 'light', 'dark'] as const).map((option) => (
            <button
              className={appearance === option ? 'active' : ''}
              key={option}
              type="button"
              onClick={() => onAppearanceChange(option)}
              aria-pressed={appearance === option}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}