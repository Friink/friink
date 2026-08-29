"use client";

import { useEffect, useState } from 'react';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { AuthApiError, loadAuthSession, saveAuthSession, updateCurrentUser, type AuthUser } from '@/lib/auth';
import type { ToastMessage } from '@/components/toast-stack';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'profile' | 'account' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  activeTab?: SettingsTab;
  onTabChange?: (id: string) => void;
  onUserChange?: (user: AuthUser) => void;
  onToast?: (message: string, tone?: ToastMessage['tone']) => void;
};

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function SettingsScreen({ user, appearance, onAppearanceChange, activeTab = 'general', onUserChange, onToast }: SettingsScreenProps) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.name);
  const [about, setAbout] = useState(user.about);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const [usernameStatus, setUsernameStatus] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [nameStatus, setNameStatus] = useState('');
  const [aboutStatus, setAboutStatus] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingAbout, setIsUpdatingAbout] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
    setDisplayName(user.name);
    setAbout(user.about);
    setIsPrivate(user.isPrivate);
    setUsernameStatus('');
    setEmailStatus('');
    setNameStatus('');
    setAboutStatus('');
  }, [user.username, user.email, user.name, user.about, user.isPrivate]);

  const hasUsernameChanged = username !== user.username;
  const isUsernameValid = USERNAME_PATTERN.test(username);
  const canUpdateUsername = hasUsernameChanged && isUsernameValid && !isUpdatingUsername;
  const hasEmailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canUpdateEmail = hasEmailChanged && isEmailValid && !isUpdatingEmail;
  const isDisplayNameValid = displayName.trim().length > 0 && displayName.trim().length <= 120;
  const isAboutValid = about.length <= 256;
  const hasNameChanged = displayName.trim() !== user.name;
  const hasAboutChanged = about !== user.about;
  const canUpdateName = hasNameChanged && isDisplayNameValid && !isUpdatingName;
  const canUpdateAbout = hasAboutChanged && isAboutValid && !isUpdatingAbout;

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
      onToast?.('Username updated.', 'success');
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
      onToast?.('Email updated.', 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update email.');
    } finally {
      setIsUpdatingEmail(false);
    }
  }

  async function handleNameUpdate() {
    if (!canUpdateName) {
      if (hasNameChanged && !isDisplayNameValid) {
        onToast?.('Name is required and must be 120 characters or fewer.');
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your name.');
      return;
    }

    setIsUpdatingName(true);
    setNameStatus('');
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, {
        displayName: displayName.trim(),
      });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setDisplayName(updatedSession.user.name);
      setNameStatus('Name updated.');
      onToast?.('Name updated.', 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update name.');
    } finally {
      setIsUpdatingName(false);
    }
  }

  async function handleAboutUpdate() {
    if (!canUpdateAbout) {
      if (hasAboutChanged && !isAboutValid) {
        onToast?.('About must be 256 characters or fewer.');
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your about text.');
      return;
    }

    setIsUpdatingAbout(true);
    setAboutStatus('');
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, {
        about,
      });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setAbout(updatedSession.user.about);
      setAboutStatus('About updated.');
      onToast?.('About updated.', 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update about text.');
    } finally {
      setIsUpdatingAbout(false);
    }
  }

  async function handlePrivacyUpdate(nextIsPrivate: boolean) {
    if (nextIsPrivate === user.isPrivate || isUpdatingPrivacy) {
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your privacy setting.');
      return;
    }

    setIsUpdatingPrivacy(true);
    setIsPrivate(nextIsPrivate);
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, {
        isPrivate: nextIsPrivate,
      });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setIsPrivate(updatedSession.user.isPrivate);
      onToast?.(`Privacy setting updated. Profile is now ${updatedSession.user.isPrivate ? 'private' : 'public'}.`, 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update privacy setting.');
      setIsPrivate(user.isPrivate);
    } finally {
      setIsUpdatingPrivacy(false);
    }
  }

  return (
    <PageSurface className="simple-screen settings-screen">
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
                  <SaveTickButton disabled={!canUpdateEmail} busy={isUpdatingEmail} onClick={handleEmailUpdate} label="Update email" />
                </div>
                {emailStatus && <span className="settings-field-message" role="status">{emailStatus}</span>}
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
              avatar={<span className="settings-icon"><i className="fa-solid fa-signature" aria-hidden="true" /></span>}
              title="Name"
              subtitle="Update the public name shown on your profile."
              className="settings-row settings-row-expanded"
            >
              <label className="settings-field">
                <span className="settings-field-label">Name</span>
                <div className="settings-field-row">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setNameStatus('');
                    }}
                    placeholder="Name"
                    autoComplete="name"
                  />
                  <SaveTickButton disabled={!canUpdateName} busy={isUpdatingName} onClick={handleNameUpdate} label="Update name" />
                </div>
              </label>
              {nameStatus && <span className="settings-field-message" role="status">{nameStatus}</span>}
            </ListRow>

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Username"
              subtitle="Update the username people use to find and mention you."
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
                  <SaveTickButton disabled={!canUpdateUsername} busy={isUpdatingUsername} onClick={handleUsernameUpdate} label="Update username" />
                </div>
                {usernameStatus && <span className="settings-field-message" role="status">{usernameStatus}</span>}
              </label>
            </ListRow>

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-user-pen" aria-hidden="true" /></span>}
              title="About"
              subtitle="Update the short public bio shown on your profile."
              className="settings-row settings-row-expanded"
            >
              <label className="settings-field">
                <span className="settings-field-label">About</span>
                <textarea
                  className="settings-about-field"
                  value={about}
                  maxLength={256}
                  onChange={(event) => {
                    setAbout(event.target.value);
                    setAboutStatus('');
                  }}
                  placeholder="About"
                />
                <span className="settings-field-count">{about.length}/256</span>
              </label>
              <div className="settings-field-actions">
                <SaveTickButton disabled={!canUpdateAbout} busy={isUpdatingAbout} onClick={handleAboutUpdate} label="Update about" />
              </div>
              {aboutStatus && <span className="settings-field-message" role="status">{aboutStatus}</span>}
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
              trailing={
                <button
                  type="button"
                  className={`settings-toggle-pill${isPrivate ? ' active' : ''}`}
                  onClick={() => handlePrivacyUpdate(!isPrivate)}
                  disabled={isUpdatingPrivacy}
                  aria-pressed={isPrivate}
                >
                  {isPrivate ? 'On' : 'Off'}
                </button>
              }
              className="settings-row"
            />

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></span>}
              title="Direct messages"
              subtitle="People you follow can message you."
              trailing={<button type="button" className="settings-toggle-pill" disabled>Off</button>}
              className="settings-row"
            />

            <ListRow
              avatar={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Mentions"
              subtitle="Control who can mention you in conversations."
              trailing={<button type="button" className="settings-toggle-pill active" disabled>On</button>}
              className="settings-row"
            />
          </div>
        </div>
      )}
    </PageSurface>
  );
}

function SaveTickButton({
  disabled,
  busy,
  onClick,
  label,
}: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button className="settings-update-button" type="button" disabled={disabled} onClick={onClick} aria-label={label} title={label}>
      <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`} aria-hidden="true" />
    </button>
  );
}
