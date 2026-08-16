"use client";

import { useState } from 'react';
import { TabBar } from '@/components/tab-bar';
import type { AuthUser } from '@/lib/auth';

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

  return (
    <section className="simple-screen settings-screen">
      <div className="settings-header" />

      <TabBar
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as SettingsTab)}
        containerClass="tab-bar settings-tabs"
        itemClass="tab-bar__item settings-tab"
        ariaLabel="Settings sections"
      />

      {activeTab === 'general' && (
        <div className="settings-panel">
          <div className="settings-preference">
            <div>
              <h3>Theme</h3>
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
        </div>
      )}

      {activeTab === 'account' && (
        <div className="settings-panel">
          <div className="settings-preference">
            <div>
              <h3>Username</h3>
              <p>Update the name people see on your profile.</p>
            </div>
            <label className="settings-field">
              <span className="settings-field-label">Username</span>
              <div className="input-with-prefix">
                <span className="input-prefix">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.replace(/^@+/, ''))}
                  placeholder="username"
                  aria-label="username"
                />
              </div>
            </label>
          </div>

          <div className="settings-preference">
            <div>
              <h3>User ID</h3>
              <p>This unique identifier can’t be changed by you.</p>
            </div>
            <label className="settings-field">
              <span className="settings-field-label">Unique user ID</span>
              <input type="text" value={user.id} readOnly aria-readonly="true" />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="settings-panel">
          <div className="settings-preference">
            <div>
              <h3>Privacy & Safety</h3>
              <p>Control the basics of how your account is shared.</p>
            </div>

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
    </section>
  );
}