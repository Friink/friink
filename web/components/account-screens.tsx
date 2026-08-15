import { useState } from 'react';
import type { AuthUser } from '@/lib/auth';
import { TabBar } from './tab-bar';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'account' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
};

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'privacy', label: 'Privacy & Safety' },
];

export function SettingsScreen({ user, appearance, onAppearanceChange }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);

  return (
    <section className="settings-screen">
      <div className="settings-header" />

      <TabBar tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id)} ariaLabel="Settings sections" />

      <div className="settings-screen-content">
        {activeTab === 'general' && (
          <div className="settings-panel">
            <div className="settings-preference">
              <div>
                <h3>Theme</h3>
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
          </div>
        )}

        {activeTab === 'account' && (
          <div className="settings-panel">
            <div className="settings-preference">
              <div>
                <h3>Username</h3>
              </div>
              <label className="settings-field">
                <input
                  type="text"
                  aria-label="Username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="@username"
                />
              </label>
            </div>

            <div className="settings-preference">
              <div>
                <h3>Email</h3>
              </div>
              <label className="settings-field">
                <input
                  type="email"
                  aria-label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <div className="settings-preference">
              <div>
                <h3>User ID</h3>
              </div>
              <label className="settings-field">
                <input type="text" aria-label="Unique user ID" value={user.id} readOnly aria-readonly="true" />
              </label>
              <p className="settings-note">This unique identifier can’t be changed by you.</p>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="settings-panel">
            <div className="settings-preference">

              <div className="settings-toggle-list">
                <div className="settings-toggle-item">
                  <div>
                    <h4>Private profile</h4>
                    <p>Only approved followers can view your public posts.</p>
                  </div>
                  <button type="button" className="settings-toggle-pill active">On</button>
                </div>

                <div className="settings-toggle-item">
                  <div>
                    <h4>Direct messages</h4>
                    <p>People you follow can message you.</p>
                  </div>
                  <button type="button" className="settings-toggle-pill">Off</button>
                </div>

                <div className="settings-toggle-item">
                  <div>
                    <h4>Mentions</h4>
                    <p>Control who can mention you in conversations.</p>
                  </div>
                  <button type="button" className="settings-toggle-pill active">On</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}