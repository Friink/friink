"use client";

import { useState, useEffect } from 'react';
import { AuthApiError, loadAuthSession, saveAuthSession, updateCurrentUser, type AuthUser } from '@/lib/auth';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'account' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  activeTab?: SettingsTab;
  onTabChange?: (id: string) => void;
  onUserChange?: (user: AuthUser) => void;
};

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function SettingsScreen({ user, appearance, onAppearanceChange, activeTab = 'general', onUserChange }: SettingsScreenProps) {
  const [username, setUsername] = useState(user.username);
  const [usernameStatus, setUsernameStatus] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [active, setActive] = useState<SettingsTab>(activeTab);

  // keep local active state in sync when parent-controlled `activeTab` changes
  useEffect(() => {
    setActive(activeTab as SettingsTab);
  }, [activeTab]);

  useEffect(() => {
    setUsername(user.username);
    setUsernameStatus('');
  }, [user.username]);

  const hasUsernameChanged = username !== user.username;
  const isUsernameValid = USERNAME_PATTERN.test(username);
  const canUpdateUsername = hasUsernameChanged && isUsernameValid && !isUpdatingUsername;

  async function handleUsernameUpdate() {
    if (!canUpdateUsername) {
      if (hasUsernameChanged && !isUsernameValid) {
        setUsernameStatus("Username may contain only letters, numbers, '-', '_', and '.' with no spaces.");
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      setUsernameStatus('Please log in again to update your username.');
      return;
    }

    setIsUpdatingUsername(true);
    setUsernameStatus('');
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, { username });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setUsername(updatedSession.user.username);
      setUsernameStatus('Username updated.');
    } catch (error) {
      setUsernameStatus(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update username.');
    } finally {
      setIsUpdatingUsername(false);
    }
  }

  const tabs = [
    { id: 'general', label: 'All' },
    { id: 'account', label: 'Account' },
    { id: 'privacy', label: 'Privacy' },
  ];

  return (
    <section className="simple-screen settings-screen">
      <div className="settings-header" />

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
              <div className="settings-field-row">
                <div className="input-with-prefix">
                  <span className="input-prefix">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value.replace(/^@+/, ''));
                      setUsernameStatus('');
                    }}
                    placeholder="username"
                    aria-label="username"
                    autoComplete="off"
                  />
                </div>
                <button className="settings-update-button" type="button" disabled={!canUpdateUsername} onClick={handleUsernameUpdate}>
                  {isUpdatingUsername ? 'Updating...' : 'Update'}
                </button>
              </div>
              {usernameStatus && <span className="settings-field-message" role="status">{usernameStatus}</span>}
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
