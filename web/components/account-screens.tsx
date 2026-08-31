"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { AuthApiError, changePassword, loadAuthSession, saveAuthSession, updateCurrentUser, uploadProfilePicture, type AuthUser } from '@/lib/auth';
import type { ToastInput, ToastMessage } from '@/components/toast-stack';
import { compressImage, ImageCompressionError, validateImageFile } from '@/lib/image-compression';
import { createCroppedImage, getImageDimensions, type CropPixels } from '@/lib/crop-image';
import { ProfilePictureCropModal } from '@/components/profile-picture-crop-modal';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'profile' | 'account' | 'subscription' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  activeTab?: SettingsTab;
  onTabChange?: (id: string) => void;
  onUserChange?: (user: AuthUser) => void;
  onToast?: (message: ToastInput, tone?: ToastMessage['tone']) => void;
};

type SettingsRowProps = {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  children?: ReactNode;
  className?: string;
  trailing?: ReactNode;
  save?: { disabled: boolean; busy: boolean; onClick: () => void; label: string };
};

function SettingsRow({ icon, title, subtitle, children, className = 'settings-row settings-row-expanded', trailing, save }: SettingsRowProps) {
  const saveControl = save ? <SaveTickButton disabled={save.disabled} busy={save.busy} onClick={save.onClick} label={save.label} /> : null;
  return (
    <ListRow
      avatar={icon}
      title={title}
      subtitle={subtitle}
      trailing={trailing ?? saveControl}
      className={className}
    >
      {children}
    </ListRow>
  );
}

function SettingsToggle({ value, onChange, disabled = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <span className="settings-toggle" role="group" aria-label="Setting state">
      <button type="button" className={value ? 'active' : ''} onClick={() => onChange(true)} disabled={disabled} aria-pressed={value}>On</button>
      <button type="button" className={!value ? 'active' : ''} onClick={() => onChange(false)} disabled={disabled} aria-pressed={!value}>Off</button>
    </span>
  );
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordCriteria, setShowPasswordCriteria] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingAbout, setIsUpdatingAbout] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState(appearance);
  const [privacyDraft, setPrivacyDraft] = useState(user.isPrivate);
  const [directMessagesDraft, setDirectMessagesDraft] = useState(false);
  const [directMessagesSaved, setDirectMessagesSaved] = useState(false);
  const [mentionsDraft, setMentionsDraft] = useState(true);
  const [mentionsSaved, setMentionsSaved] = useState(true);
  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
    setDisplayName(user.name);
    setAbout(user.about);
    setIsPrivate(user.isPrivate);
    setPrivacyDraft(user.isPrivate);
    setAppearanceDraft(appearance);
    setProfilePicturePreview(user.profilePictureUrl);
    setProfilePictureFile(null);
    setUsernameStatus('');
    setEmailStatus('');
    setNameStatus('');
    setAboutStatus('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordCriteria(false);
    setPasswordStatus('');
  }, [user.username, user.email, user.name, user.about, user.isPrivate, user.profilePictureUrl, appearance]);

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
  const canUpdateAppearance = appearanceDraft !== appearance;
  const canUpdatePrivacy = privacyDraft !== user.isPrivate && !isUpdatingPrivacy;
  const canUpdateDirectMessages = directMessagesDraft !== directMessagesSaved;
  const canUpdateMentions = mentionsDraft !== mentionsSaved;
  const isNewPasswordValid = newPassword.length >= 8
    && !/\s/.test(newPassword)
    && /[A-Z]/.test(newPassword)
    && /[a-z]/.test(newPassword)
    && /\d/.test(newPassword)
    && /[^A-Za-z0-9\s]/.test(newPassword);
  const canChangePassword = Boolean(currentPassword) && isNewPasswordValid && newPassword === confirmPassword && !isChangingPassword;

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

  async function handlePasswordChange() {
    if (!canChangePassword) {
      if (!currentPassword) {
        onToast?.('Enter your current password.');
      } else if (!isNewPasswordValid) {
        onToast?.('New password must be 8+ characters with uppercase, lowercase, number, and special character, with no spaces.');
      } else if (newPassword !== confirmPassword) {
        onToast?.('New passwords do not match.');
      }
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to change your password.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordStatus('');
    try {
      await changePassword(session.accessToken, currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('Password updated.');
      onToast?.('Password updated.', 'success');
    } catch (error) {
      const message = error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update password.';
      setPasswordStatus(message);
      onToast?.(message);
    } finally {
      setIsChangingPassword(false);
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

  async function handlePrivacyUpdate() {
    if (!canUpdatePrivacy) {
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update your privacy setting.');
      return;
    }

    setIsUpdatingPrivacy(true);
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, {
        isPrivate: privacyDraft,
      });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setIsPrivate(updatedSession.user.isPrivate);
      setPrivacyDraft(updatedSession.user.isPrivate);
      onToast?.(`Privacy setting updated. Profile is now ${updatedSession.user.isPrivate ? 'private' : 'public'}.`, 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update privacy setting.');
      setIsPrivate(user.isPrivate);
      setPrivacyDraft(user.isPrivate);
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
            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-palette" aria-hidden="true" /></span>}
              title="Theme"
              subtitle="Choose how Friink looks on this device."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canUpdateAppearance, busy: false, onClick: () => onAppearanceChange(appearanceDraft), label: 'Update theme' }}
            >
              <span className="appearance-toggle" role="group" aria-label="Appearance preference">
                {(['system', 'light', 'dark'] as const).map((option) => (
                  <button
                    className={appearanceDraft === option ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() => setAppearanceDraft(option)}
                    aria-pressed={appearanceDraft === option}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </span>
            </SettingsRow>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="settings-panel">
          <div className="settings-section">
            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-envelope" aria-hidden="true" /></span>}
              title="Email"
              subtitle="Update the email address for this account."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canUpdateEmail, busy: isUpdatingEmail, onClick: handleEmailUpdate, label: 'Update email' }}
            >
              <label className="settings-field">
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
                </div>
                {emailStatus && <span className="settings-field-message" role="status">{emailStatus}</span>}
              </label>
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-key" aria-hidden="true" /></span>}
              title="Password"
              subtitle="Change the password you use to sign in."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canChangePassword, busy: isChangingPassword, onClick: handlePasswordChange, label: 'Update password' }}
            >
              <div className="settings-password-fields">
                <label className="settings-field">
                  <span>Current password</span>
                  <div className="settings-password-input">
                    <input name="change-current-password" type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setPasswordStatus(''); }} autoComplete="current-password" />
                    <button className="password-toggle" type="button" onClick={() => setShowCurrentPassword((current) => !current)} aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'} aria-pressed={showCurrentPassword}>
                      <i className={`fa-regular ${showCurrentPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                    </button>
                  </div>
                </label>
                <label className="settings-field">
                  <span>New password</span>
                  <div className="settings-password-input">
                    <input name="change-new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onFocus={() => setShowPasswordCriteria(true)} onChange={(event) => { setNewPassword(event.target.value); setPasswordStatus(''); }} autoComplete="new-password" minLength={8} pattern={PASSWORD_PATTERN.source} title="Use at least 8 characters with uppercase, lowercase, number, and special character, with no spaces." aria-describedby="password-criteria" />
                    <button className="password-toggle" type="button" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword}>
                      <i className={`fa-regular ${showNewPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                    </button>
                  </div>
                  {(showPasswordCriteria || newPassword.length > 0) && (
                    <ul id="password-criteria" className="password-criteria" aria-label="Password requirements">
                      <li className={newPassword.length >= 8 ? 'met' : ''}><i className="fa-solid fa-check" aria-hidden="true" />At least 8 characters</li>
                      <li className={/[A-Z]/.test(newPassword) ? 'met' : ''}><i className="fa-solid fa-check" aria-hidden="true" />One uppercase letter</li>
                      <li className={/[a-z]/.test(newPassword) ? 'met' : ''}><i className="fa-solid fa-check" aria-hidden="true" />One lowercase letter</li>
                      <li className={/\d/.test(newPassword) ? 'met' : ''}><i className="fa-solid fa-check" aria-hidden="true" />One number</li>
                      <li className={/[^A-Za-z0-9\s]/.test(newPassword) ? 'met' : ''}><i className="fa-solid fa-check" aria-hidden="true" />One special character</li>
                      <li className={!/\s/.test(newPassword) ? 'met' : ''}><i className="fa-solid fa-check" aria-hidden="true" />No spaces</li>
                    </ul>
                  )}
                </label>
                <label className="settings-field">
                  <span>Confirm new password</span>
                  <div className="settings-password-input">
                    <input name="change-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordStatus(''); }} autoComplete="new-password" minLength={8} pattern={PASSWORD_PATTERN.source} title="Use at least 8 characters with uppercase, lowercase, number, and special character, with no spaces." />
                    <button className="password-toggle" type="button" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide new password confirmation' : 'Show new password confirmation'} aria-pressed={showConfirmPassword}>
                      <i className={`fa-regular ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                    </button>
                  </div>
                </label>
                {passwordStatus && <span className="settings-field-message" role="status">{passwordStatus}</span>}
              </div>
            </SettingsRow>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="settings-panel">
          <div className="settings-section">
            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-crown" aria-hidden="true" /></span>}
              title="Current plan"
              subtitle="Your Friink plan and subscription options."
              className="settings-row settings-row-expanded"
              trailing={<Link className="settings-secondary-button settings-subscription-link" href="/subscriptions">View plans</Link>}
            >
              <div className="settings-plan-summary">
                <strong>Friink Free</strong>
                <span>Free · Never expires</span>
              </div>
            </SettingsRow>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="settings-panel">
          <div className="settings-section">
            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-camera" aria-hidden="true" /></span>}
              title="Profile picture"
              subtitle="Choose an optional JPG, PNG, or WebP picture for your profile."
              className="settings-row settings-row-expanded"
              trailing={<button className="settings-secondary-button settings-upload-trigger" type="button" aria-label="Upload profile picture" title="Upload profile picture" onClick={() => profilePictureInputRef.current?.click()}><i className="fa-solid fa-upload" aria-hidden="true" /><span>Upload</span></button>}
            >
              <div className="profile-picture-picker">
                <div className="profile-picture-preview" aria-hidden="true">
                  {profilePicturePreview ? <img src={profilePicturePreview} alt="" /> : <i className="fa-regular fa-user" />}
                </div>
                <div className="profile-picture-controls">
                  <input ref={profilePictureInputRef} className="profile-picture-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => handleProfilePictureSelected(event.target.files?.[0])} />
                </div>
                {cropSource && (
                  <ProfilePictureCropModal source={cropSource} crop={crop} zoom={zoom} maxZoom={maxZoom} croppedAreaPixels={croppedAreaPixels} busy={isProcessingProfilePicture || isUploadingProfilePicture} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={setCroppedAreaPixels} onCancel={handleCropCancel} onConfirm={handleCropConfirm} />
                )}
                {(isProcessingProfilePicture || isUploadingProfilePicture || cropSource || profilePictureFile) && (
                  <span className="settings-field-message" role="status">
                    {isProcessingProfilePicture ? 'Processing image...' : isUploadingProfilePicture ? 'Uploading profile picture...' : cropSource ? 'Adjust your crop, then confirm to upload.' : 'Ready to upload.'}
                  </span>
                )}
              </div>
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-signature" aria-hidden="true" /></span>}
              title="Name"
              subtitle="Update the public name shown on your profile."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canUpdateName, busy: isUpdatingName, onClick: handleNameUpdate, label: 'Update name' }}
            >
              <label className="settings-field">
                <div className="settings-field-row">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setNameStatus('');
                    }}
                    placeholder="Name"
                    aria-label="Name"
                    autoComplete="name"
                  />
                </div>
              </label>
              {nameStatus && <span className="settings-field-message" role="status">{nameStatus}</span>}
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Username"
              subtitle="Update the username people use to find and mention you."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canUpdateUsername, busy: isUpdatingUsername, onClick: handleUsernameUpdate, label: 'Update username' }}
            >
              <label className="settings-field">
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
                </div>
                {usernameStatus && <span className="settings-field-message" role="status">{usernameStatus}</span>}
              </label>
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-user-pen" aria-hidden="true" /></span>}
              title="About"
              subtitle="Update the short public bio shown on your profile."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canUpdateAbout, busy: isUpdatingAbout, onClick: handleAboutUpdate, label: 'Update about' }}
            >
              <label className="settings-field">
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
                    aria-label="About"
                  />
                  <span className="settings-field-count">{about.length}/128</span>
                </div>
              </label>
              {aboutStatus && <span className="settings-field-message" role="status">{aboutStatus}</span>}
            </SettingsRow>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="settings-panel">
          <div className="settings-section">
            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-lock" aria-hidden="true" /></span>}
              title="Private profile"
              subtitle="Only approved followers can view your public posts."
              className="settings-row"
              trailing={
                <>
                  <SettingsToggle value={privacyDraft} onChange={setPrivacyDraft} disabled={isUpdatingPrivacy} />
                  <SaveTickButton disabled={!canUpdatePrivacy} busy={isUpdatingPrivacy} onClick={handlePrivacyUpdate} label="Update private profile" />
                </>
              }
            />

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></span>}
              title="Direct messages"
              subtitle="People you follow can message you."
              className="settings-row"
              trailing={
                <>
                  <SettingsToggle value={directMessagesDraft} onChange={setDirectMessagesDraft} />
                  <SaveTickButton disabled={!canUpdateDirectMessages} busy={false} onClick={() => { setDirectMessagesSaved(directMessagesDraft); onToast?.('Direct messages setting updated.', 'success'); }} label="Update direct messages" />
                </>
              }
            />

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Mentions"
              subtitle="Control who can mention you in conversations."
              className="settings-row"
              trailing={
                <>
                  <SettingsToggle value={mentionsDraft} onChange={setMentionsDraft} />
                  <SaveTickButton disabled={!canUpdateMentions} busy={false} onClick={() => { setMentionsSaved(mentionsDraft); onToast?.('Mentions setting updated.', 'success'); }} label="Update mentions" />
                </>
              }
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
      <span>{busy ? 'Updating…' : label}</span>
    </button>
  );
}
