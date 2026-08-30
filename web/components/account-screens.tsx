"use client";

import { useEffect, useRef, useState } from 'react';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { AuthApiError, loadAuthSession, saveAuthSession, updateCurrentUser, uploadProfilePicture, type AuthUser } from '@/lib/auth';
import type { ToastInput, ToastMessage } from '@/components/toast-stack';
import { compressImage, ImageCompressionError, validateImageFile } from '@/lib/image-compression';
import { createCroppedImage, getImageDimensions, type CropPixels } from '@/lib/crop-image';
import Cropper from 'react-easy-crop';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'profile' | 'account' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  activeTab?: SettingsTab;
  onTabChange?: (id: string) => void;
  onUserChange?: (user: AuthUser) => void;
  onToast?: (message: ToastInput, tone?: ToastMessage['tone']) => void;
};

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function getProfilePictureErrorDetail(error: AuthApiError) {
  const detail = error.detail.toLowerCase();
  if (detail.includes('reached r2')) {
    return 'Your image was uploaded, but we couldn’t finish saving it to your profile. Please try again.';
  }
  if (detail.includes('browser blocked') || detail.includes('could not be reached')) {
    return 'We couldn’t reach the upload service. Check your connection and try again.';
  }
  if (detail.includes('session') || error.status === 401) {
    return 'Your sign-in may have expired. Please sign in again and retry.';
  }
  if (error.status === 403) {
    return 'The image upload was not accepted. Please try again with the same or another image.';
  }
  if (error.status === 404) {
    return 'The upload service was temporarily unavailable. Please try again in a moment.';
  }
  if (error.status === 502 || error.status === 503) {
    return 'Profile picture uploads are temporarily unavailable. Please try again shortly.';
  }
  return 'We couldn’t finish updating your profile picture. Please try again.';
}

export function SettingsScreen({ user, appearance, onAppearanceChange, activeTab = 'general', onUserChange, onToast }: SettingsScreenProps) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.name);
  const [about, setAbout] = useState(user.about);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(user.profilePictureUrl);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [isProcessingProfilePicture, setIsProcessingProfilePicture] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropPixels | null>(null);
  const profilePictureInputRef = useRef<HTMLInputElement | null>(null);
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
    setProfilePicturePreview(user.profilePictureUrl);
    setProfilePictureFile(null);
    setUsernameStatus('');
    setEmailStatus('');
    setNameStatus('');
    setAboutStatus('');
  }, [user.username, user.email, user.name, user.about, user.isPrivate, user.profilePictureUrl]);

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

  async function handleProfilePictureSelected(file: File | undefined) {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      onToast?.(validationError);
      return;
    }
    setIsProcessingProfilePicture(true);
    try {
      const dimensions = await getImageDimensions(file);
      const shorterEdge = Math.min(dimensions.width, dimensions.height);
      if (shorterEdge < 128) {
        onToast?.('This image is too small — please choose a photo at least 128x128px.');
        return;
      }
      setProfilePictureFile(file);
      const sourceUrl = URL.createObjectURL(file);
      setCropSource(sourceUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setMaxZoom(Math.max(1, shorterEdge / 128));
      setCroppedAreaPixels(null);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'This image could not be read. Please choose another image.');
    } finally {
      setIsProcessingProfilePicture(false);
    }
  }

  async function handleCropConfirm() {
    if (!cropSource || !croppedAreaPixels || !profilePictureFile) return;
    setIsProcessingProfilePicture(true);
    try {
      const croppedFile = await createCroppedImage(cropSource, croppedAreaPixels, profilePictureFile.name);
      await handleProfilePictureUpload(croppedFile);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Could not crop this image.');
    } finally {
      setIsProcessingProfilePicture(false);
    }
  }

  function handleCropCancel() {
    setCropSource(null);
    setProfilePictureFile(null);
    setProfilePicturePreview(user.profilePictureUrl);
  }

  async function handleProfilePictureUpload(fileToUpload = profilePictureFile) {
    if (!fileToUpload || isUploadingProfilePicture) return;
    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your profile picture.');
      return;
    }
    setIsProcessingProfilePicture(true);
    try {
      const compressedFile = await compressImage(fileToUpload, 'avatar');
      setIsProcessingProfilePicture(false);
      setIsUploadingProfilePicture(true);
      const updatedUser = await uploadProfilePicture(session.accessToken, compressedFile);
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setProfilePictureFile(null);
      setProfilePicturePreview(updatedSession.user.profilePictureUrl);
      setCropSource(null);
      onToast?.('Profile picture updated.', 'success');
    } catch (error) {
      if (error instanceof AuthApiError) {
        onToast?.({
          title: 'Profile picture upload failed',
          message: 'We couldn’t update your profile picture.',
          code: error.displayCode ?? 'PROFILE_PICTURE_UPLOAD_UNKNOWN',
          detail: getProfilePictureErrorDetail(error),
        });
      } else if (error instanceof ImageCompressionError) {
        onToast?.({
          title: 'Profile picture processing failed',
          message: 'We couldn’t prepare this image for upload.',
          code: 'PROFILE_PICTURE_PROCESSING',
          detail: error.message,
        });
      } else {
        onToast?.({
          title: 'Profile picture upload failed',
          message: 'We couldn’t update your profile picture.',
          code: 'PROFILE_PICTURE_UPLOAD_UNKNOWN',
          detail: error instanceof Error ? error.message : 'Please try again.',
        });
      }
      // The preview is optimistic while the file is being sent. Restore the
      // last server-confirmed image so a failed confirmation cannot look like
      // a successful profile update.
      setProfilePicturePreview(user.profilePictureUrl);
    } finally {
      setIsProcessingProfilePicture(false);
      setIsUploadingProfilePicture(false);
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
              avatar={<span className="settings-icon"><i className="fa-solid fa-camera" aria-hidden="true" /></span>}
              title="Profile picture"
              subtitle="Choose an optional JPG, PNG, or WebP picture for your profile."
              className="settings-row settings-row-expanded"
            >
              <div className="profile-picture-picker">
                <div className="profile-picture-preview" aria-hidden="true">
                  {profilePicturePreview ? <img src={profilePicturePreview} alt="" /> : <i className="fa-regular fa-user" />}
                </div>
                <div className="profile-picture-controls">
                  <input ref={profilePictureInputRef} className="profile-picture-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => handleProfilePictureSelected(event.target.files?.[0])} />
                  <button className="settings-secondary-button" type="button" onClick={() => profilePictureInputRef.current?.click()}>Upload</button>
                </div>
                {cropSource && (
                  <div className="profile-picture-crop-modal" role="dialog" aria-modal="true" aria-labelledby="profile-picture-crop-title" onMouseDown={(event) => { if (event.target === event.currentTarget) handleCropCancel(); }}>
                    <div className="profile-picture-crop-dialog">
                      <div className="profile-picture-crop-header">
                        <h2 id="profile-picture-crop-title">Crop profile picture</h2>
                        <button className="profile-picture-crop-close" type="button" aria-label="Cancel crop" onClick={handleCropCancel}>×</button>
                      </div>
                      <p className="profile-picture-crop-help">Drag the image and adjust the zoom to choose a square crop.</p>
                      <div className="profile-picture-crop-stage">
                        <Cropper
                          image={cropSource}
                          crop={crop}
                          zoom={zoom}
                          maxZoom={maxZoom}
                          aspect={1}
                          cropShape="rect"
                          showGrid
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                        />
                      </div>
                      <label className="profile-picture-zoom">
                        <span>Zoom</span>
                        <input type="range" min={1} max={maxZoom} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                      </label>
                      <div className="profile-picture-crop-actions">
                        <button className="settings-secondary-button" type="button" disabled={isProcessingProfilePicture} onClick={handleCropCancel}>Cancel</button>
                        <SaveTickButton disabled={isProcessingProfilePicture || isUploadingProfilePicture} busy={isProcessingProfilePicture || isUploadingProfilePicture} onClick={handleCropConfirm} label="Upload profile picture" />
                      </div>
                    </div>
                  </div>
                )}
                {(isProcessingProfilePicture || isUploadingProfilePicture || cropSource || profilePictureFile) && (
                  <span className="settings-field-message" role="status">
                    {isProcessingProfilePicture ? 'Processing image...' : isUploadingProfilePicture ? 'Uploading profile picture...' : cropSource ? 'Adjust your crop, then confirm to upload.' : 'Ready to upload.'}
                  </span>
                )}
              </div>
            </ListRow>

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
                <div className="settings-about-control">
                  <textarea
                    className="settings-about-field"
                    value={about}
                    maxLength={128}
                    onChange={(event) => {
                      setAbout(event.target.value);
                      setAboutStatus('');
                    }}
                    placeholder="About"
                  />
                  <span className="settings-field-count">{about.length}/128</span>
                </div>
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
