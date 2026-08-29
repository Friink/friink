"use client";

import { useEffect, useState } from 'react';
import { ListRow } from '@/components/list-row';
import { AuthApiError, loadAuthSession, saveAuthSession, updateCurrentUser, type AuthUser } from '@/lib/auth';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'profile' | 'account' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  activeTab?: SettingsTab;
  onTabChange?: (id: string) => void;
  onUserChange?: (user: AuthUser) => void;
  onToast?: (message: string) => void;
};

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function SettingsScreen({ user, appearance, onAppearanceChange, activeTab = 'general', onUserChange, onToast }: SettingsScreenProps) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.name);
  const [about, setAbout] = useState(user.about);
  const [usernameStatus, setUsernameStatus] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
    setDisplayName(user.name);
    setAbout(user.about);
    setUsernameStatus('');
    setEmailStatus('');
    setProfileStatus('');
  }, [user.username, user.email, user.name, user.about]);

  const hasUsernameChanged = username !== user.username;
  const isUsernameValid = USERNAME_PATTERN.test(username);
  const canUpdateUsername = hasUsernameChanged && isUsernameValid && !isUpdatingUsername;
  const hasEmailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canUpdateEmail = hasEmailChanged && isEmailValid && !isUpdatingEmail;
  const hasProfileChanged = displayName.trim() !== user.name || about !== user.about;
  const isDisplayNameValid = displayName.trim().length > 0 && displayName.trim().length <= 120;
  const isAboutValid = about.length <= 256;
  const canUpdateProfile = hasProfileChanged && isDisplayNameValid && isAboutValid && !isUpdatingProfile;

  async function handleUsernameUpdate() {
    if (!canUpdateUsername) {
      if (hasUsernameChanged && !isUsernameValid) {
        onToast?.("Username may contain only letters, numbers, '-', '_', and '.' with no spaces.");
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your username.');
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
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update username.');
    } finally {
      setIsUpdatingUsername(false);
    }
  }

  async function handleEmailUpdate() {
    if (!canUpdateEmail) {
      if (hasEmailChanged && !isEmailValid) {
        onToast?.('Please enter a valid email address.');
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your email.');
      return;
    }

    setIsUpdatingEmail(true);
    setEmailStatus('');
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, { email: email.trim() });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setEmail(updatedSession.user.email);
      setEmailStatus('Email updated.');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update email.');
    } finally {
      setIsUpdatingEmail(false);
    }
  }

  async function handleProfileUpdate() {
    if (!canUpdateProfile) {
      if (!isDisplayNameValid) {
        onToast?.('Name is required and must be 120 characters or fewer.');
      } else if (!isAboutValid) {
        onToast?.('About must be 256 characters or fewer.');
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your profile.');
      return;
    }

    setIsUpdatingProfile(true);
    setProfileStatus('');
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, {
        displayName: displayName.trim(),
        about,
      });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setDisplayName(updatedSession.user.name);
      setAbout(updatedSession.user.about);
      setProfileStatus('Profile updated.');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  return (
    <section className="simple-screen settings-screen">
      <div className="settings-header" />

      {activeTab === 'general' && (
        <div className="settings-panel">
          <div className="settings-section">
            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-palette" aria-hidden="true" /></span>}
              title="Theme"
              subtitle="Choose how Friink looks on this device."
              className="settings-row settings-row-expanded"
            >
              <span className="appearance-toggle" role="group" aria-label="Appearance preference">
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
              </span>
            </ListRow>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="settings-panel">
          <div className="settings-section">
            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-envelope" aria-hidden="true" /></span>}
              title="Email"
              subtitle="Update the email address for this account."
              className="settings-row settings-row-expanded"
            >
              <label className="settings-field">
                <span className="settings-field-label">Email</span>
                <div className="settings-field-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailStatus('');
                    }}
                    placeholder="you@example.com"
                    aria-label="email"
                    autoComplete="email"
                  />
                  <button className="settings-update-button" type="button" disabled={!canUpdateEmail} onClick={handleEmailUpdate}>
                    {isUpdatingEmail ? 'Updating...' : 'Update'}
                  </button>
                </div>
                {emailStatus && <span className="settings-field-message" role="status">{emailStatus}</span>}
              </label>
            </ListRow>

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Username"
              subtitle="Update the name people see on your profile."
              className="settings-row settings-row-expanded"
            >
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
            </ListRow>

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-fingerprint" aria-hidden="true" /></span>}
              title="User ID"
              subtitle="This unique identifier can't be changed by you."
              className="settings-row settings-row-expanded"
            >
              <label className="settings-field">
                <span className="settings-field-label">Unique user ID</span>
                <input type="text" value={user.id} readOnly aria-readonly="true" />
              </label>
            </ListRow>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="settings-panel">
          <div className="settings-section">
            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-user-pen" aria-hidden="true" /></span>}
              title="Profile"
              subtitle="Update the public details shown on your profile."
              className="settings-row settings-row-expanded"
            >
              <label className="settings-field">
                <span className="settings-field-label">Name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setProfileStatus('');
                  }}
                  placeholder="Name"
                  autoComplete="name"
                />
              </label>
              <label className="settings-field">
                <span className="settings-field-label">About</span>
                <textarea
                  className="settings-about-field"
                  value={about}
                  maxLength={256}
                  onChange={(event) => {
                    setAbout(event.target.value);
                    setProfileStatus('');
                  }}
                  placeholder="About"
                />
                <span className="settings-field-count">{about.length}/256</span>
              </label>
              <div className="settings-field-actions">
                <button className="settings-update-button" type="button" disabled={!canUpdateProfile} onClick={handleProfileUpdate}>
                  {isUpdatingProfile ? 'Updating...' : 'Update'}
                </button>
              </div>
              {profileStatus && <span className="settings-field-message" role="status">{profileStatus}</span>}
            </ListRow>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="settings-panel">
          <div className="settings-section">
            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-lock" aria-hidden="true" /></span>}
              title="Private profile"
              subtitle="Only approved followers can view your public posts."
              trailing={<button type="button" className="settings-toggle-pill active">On</button>}
              className="settings-row"
            />

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></span>}
              title="Direct messages"
              subtitle="People you follow can message you."
              trailing={<button type="button" className="settings-toggle-pill">Off</button>}
              className="settings-row"
            />

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Mentions"
              subtitle="Control who can mention you in conversations."
              trailing={<button type="button" className="settings-toggle-pill active">On</button>}
              className="settings-row"
            />
          </div>
        </div>
      )}
    </section>
  );
}
