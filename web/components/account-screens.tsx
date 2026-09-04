"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { AuthApiError, changePassword, checkUsernameAvailability, getReadReceiptPreference, listAuthSessions, listBlockedUsers, loadAuthSession, revokeAuthSession, revokeOtherAuthSessions, saveAuthSession, unblockUser, updateCurrentUser, updateReadReceiptPreference, uploadProfilePicture, type AuthUser, type BlockedUser, type ManagedAuthSession } from '@/lib/auth';
import type { ToastInput, ToastMessage } from '@/components/toast-stack';
import { compressImage, ImageCompressionError, validateImageFile } from '@/lib/image-compression';
import { createCroppedImage, getImageDimensions, type CropPixels } from '@/lib/crop-image';
import { ProfilePictureCropModal } from '@/components/profile-picture-crop-modal';
import { Modal } from '@/components/modal';
import { ProfileCard } from '@/components/profile-card';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PasswordCriteria } from '@/components/password-criteria';

export type AppearanceMode = 'system' | 'light' | 'dark';
type SettingsTab = 'general' | 'profile' | 'account' | 'subscription' | 'privacy';

type SettingsScreenProps = {
  user: AuthUser;
  appearance: AppearanceMode;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  accentColor: string;
  onAccentColorChange: (accentColor: string) => void;
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

export function SettingsScreen({ user, appearance, onAppearanceChange, accentColor, onAccentColorChange, activeTab = 'general', onUserChange, onToast }: SettingsScreenProps) {
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
  const [accentColorDraft, setAccentColorDraft] = useState(accentColor);
  const [privacyDraft, setPrivacyDraft] = useState(user.isPrivate);
  const [directMessagesDraft, setDirectMessagesDraft] = useState(false);
  const [directMessagesSaved, setDirectMessagesSaved] = useState(false);
  const [mentionsDraft, setMentionsDraft] = useState(true);
  const [mentionsSaved, setMentionsSaved] = useState(true);
  const [readReceiptsDraft, setReadReceiptsDraft] = useState(true);
  const [readReceiptsSaved, setReadReceiptsSaved] = useState(true);
  const [isUpdatingReadReceipts, setIsUpdatingReadReceipts] = useState(false);
  const [likesVisibleDraft, setLikesVisibleDraft] = useState(user.likesVisible);
  const [likesVisibleSaved, setLikesVisibleSaved] = useState(user.likesVisible);
  const [isUpdatingLikesVisible, setIsUpdatingLikesVisible] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedQuery, setBlockedQuery] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedCursor, setBlockedCursor] = useState<string | null>(null);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const blockedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [authSessions, setAuthSessions] = useState<ManagedAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsBusyId, setSessionsBusyId] = useState<string | null>(null);
  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
    setDisplayName(user.name);
    setAbout(user.about);
    setIsPrivate(user.isPrivate);
    setPrivacyDraft(user.isPrivate);
    setLikesVisibleDraft(user.likesVisible);
    setLikesVisibleSaved(user.likesVisible);
    setAppearanceDraft(appearance);
    setAccentColorDraft(accentColor);
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
  }, [user.username, user.email, user.name, user.about, user.isPrivate, user.likesVisible, user.profilePictureUrl, appearance, accentColor]);

  useEffect(() => {
    if (activeTab !== 'account') return;
    const session = loadAuthSession();
    if (!session) return;
    let cancelled = false;
    setSessionsLoading(true);
    setSessionsError('');
    listAuthSessions(session.accessToken)
      .then((items) => { if (!cancelled) setAuthSessions(items); })
      .catch((error) => { if (!cancelled) setSessionsError(error instanceof Error ? error.message : 'Could not load sessions.'); })
      .finally(() => { if (!cancelled) setSessionsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'privacy') return;
    const session = loadAuthSession();
    if (!session) return;
    let cancelled = false;
    getReadReceiptPreference(session.accessToken)
      .then((preference) => { if (!cancelled) { setReadReceiptsDraft(preference.read_receipts_enabled); setReadReceiptsSaved(preference.read_receipts_enabled); } })
      .catch(() => { if (!cancelled) onToast?.('Could not load read-receipt preference.'); });
    return () => { cancelled = true; };
  }, [activeTab, onToast]);

  async function loadBlocked(reset = false) {
    const session = loadAuthSession();
    if (!session || blockedLoading) return;
    setBlockedLoading(true);
    try {
      const page = await listBlockedUsers(session.accessToken, blockedQuery, reset ? null : blockedCursor);
      setBlockedUsers((items) => reset ? page.items : [...items, ...page.items.filter((item) => !items.some((old) => old.id === item.id))]);
      setBlockedCursor(page.next_cursor);
    } catch (error) { onToast?.(error instanceof Error ? error.message : 'Could not load blocked people.'); }
    finally { setBlockedLoading(false); }
  }

  useEffect(() => {
    if (!blockedOpen) return;
    const timer = window.setTimeout(() => { setBlockedUsers([]); setBlockedCursor(null); void loadBlocked(true); }, 300);
    return () => window.clearTimeout(timer);
  }, [blockedOpen, blockedQuery]);

  useEffect(() => {
    if (!blockedOpen || !blockedCursor || !blockedLoadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadBlocked(); }, { rootMargin: '160px' });
    observer.observe(blockedLoadMoreRef.current);
    return () => observer.disconnect();
  }, [blockedOpen, blockedCursor, blockedLoading]);

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
  const isAccentColorValid = /^#[0-9A-Fa-f]{6}$/.test(accentColorDraft);
  const canUpdateAccentColor = isAccentColorValid && accentColorDraft.toLowerCase() !== accentColor.toLowerCase();
  const canUpdatePrivacy = privacyDraft !== user.isPrivate && !isUpdatingPrivacy;
  const canUpdateDirectMessages = directMessagesDraft !== directMessagesSaved;
  const canUpdateMentions = mentionsDraft !== mentionsSaved;
  const canUpdateReadReceipts = readReceiptsDraft !== readReceiptsSaved && !isUpdatingReadReceipts;
  const canUpdateLikesVisible = likesVisibleDraft !== likesVisibleSaved && !isUpdatingLikesVisible;
  const isNewPasswordValid = newPassword.length >= PASSWORD_MIN_LENGTH
    && newPassword.length <= PASSWORD_MAX_LENGTH
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
      const availability = await checkUsernameAvailability(username);
      if (!availability.available && username.toLowerCase() !== user.username.toLowerCase()) {
        setUsernameStatus('Username is already taken.');
        onToast?.('Username is already taken.');
        return;
      }
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

  async function handleSessionRevoke(sessionId: string) {
    if (!window.confirm('Log out this session?')) return;
    const session = loadAuthSession();
    if (!session) return;
    setSessionsBusyId(sessionId);
    try {
      await revokeAuthSession(session.accessToken, sessionId);
      setAuthSessions((current) => current.filter((item) => item.id !== sessionId));
      onToast?.('Session logged out.', 'success');
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Could not log out this session.');
    } finally {
      setSessionsBusyId(null);
    }
  }

  async function handleRevokeOtherSessions() {
    if (!window.confirm('Log out all other sessions?')) return;
    const session = loadAuthSession();
    if (!session) return;
    setSessionsBusyId('others');
    try {
      await revokeOtherAuthSessions(session.accessToken);
      setAuthSessions((current) => current.filter((item) => item.current));
      onToast?.('All other sessions logged out.', 'success');
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Could not log out other sessions.');
    } finally {
      setSessionsBusyId(null);
    }
  }

  function formatSessionDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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

  async function handleReadReceiptsUpdate() {
    if (!canUpdateReadReceipts) return;
    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update read receipts.');
      return;
    }
    setIsUpdatingReadReceipts(true);
    try {
      const preference = await updateReadReceiptPreference(session.accessToken, readReceiptsDraft);
      setReadReceiptsDraft(preference.read_receipts_enabled);
      setReadReceiptsSaved(preference.read_receipts_enabled);
      onToast?.(`Read receipts ${preference.read_receipts_enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update read receipts.');
    } finally {
      setIsUpdatingReadReceipts(false);
    }
  }

  async function handleLikesVisibleUpdate() {
    if (!canUpdateLikesVisible) return;
    const session = loadAuthSession();
    if (!session) {
      onToast?.('Please log in again to update Like visibility.');
      return;
    }
    setIsUpdatingLikesVisible(true);
    try {
      const updatedUser = await updateCurrentUser(session.accessToken, { likesVisible: likesVisibleDraft });
      const updatedSession = { ...session, user: { ...session.user, ...updatedUser } };
      saveAuthSession(updatedSession);
      onUserChange?.(updatedSession.user);
      setLikesVisibleDraft(updatedSession.user.likesVisible);
      setLikesVisibleSaved(updatedSession.user.likesVisible);
      onToast?.(`Like visibility ${updatedSession.user.likesVisible ? 'enabled' : 'disabled'}.`, 'success');
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof Error ? error.message : 'Could not update Like visibility.');
      setLikesVisibleDraft(likesVisibleSaved);
    } finally {
      setIsUpdatingLikesVisible(false);
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

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-droplet" aria-hidden="true" /></span>}
              title="Accent color"
              subtitle="Choose the accent color used inside the app."
              className="settings-row settings-row-expanded"
              save={{ disabled: !canUpdateAccentColor, busy: false, onClick: () => onAccentColorChange(accentColorDraft.toLowerCase()), label: 'Update color' }}
            >
              <div className="accent-color-control">
                <input
                  type="text"
                  value={accentColorDraft}
                  onChange={(event) => setAccentColorDraft(event.target.value)}
                  aria-label="Accent color hex code"
                  placeholder="#33aa55"
                  maxLength={7}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  spellCheck={false}
                />
                <span
                  className={`accent-color-swatch${isAccentColorValid ? ' accent-color-swatch-valid' : ''}`}
                  ref={(element) => {
                    if (element) element.style.setProperty('--accent-preview', isAccentColorValid ? accentColorDraft : 'transparent');
                  }}
                  aria-hidden="true"
                />
                {!isAccentColorValid ? <small>Use a six-digit hex code, for example #33aa55.</small> : null}
              </div>
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
                    <input name="change-new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onFocus={() => setShowPasswordCriteria(true)} onChange={(event) => { setNewPassword(event.target.value); setPasswordStatus(''); }} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} pattern={PASSWORD_PATTERN.source} title="Use 8 to 16 characters with uppercase, lowercase, number, and special character, with no spaces." aria-describedby="password-criteria" />
                    <button className="password-toggle" type="button" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword}>
                      <i className={`fa-regular ${showNewPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                    </button>
                  </div>
                  {(showPasswordCriteria || newPassword.length > 0) && (
                    <PasswordCriteria value={newPassword} id="password-criteria" />
                  )}
                </label>
                <label className="settings-field">
                  <span>Confirm new password</span>
                  <div className="settings-password-input">
                    <input name="change-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordStatus(''); }} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} pattern={PASSWORD_PATTERN.source} title="Use 8 to 16 characters with uppercase, lowercase, number, and special character, with no spaces." />
                    <button className="password-toggle" type="button" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide new password confirmation' : 'Show new password confirmation'} aria-pressed={showConfirmPassword}>
                      <i className={`fa-regular ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                    </button>
                  </div>
                </label>
                {passwordStatus && <span className="settings-field-message" role="status">{passwordStatus}</span>}
              </div>
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-laptop" aria-hidden="true" /></span>}
              title="Sessions"
              subtitle="Manage the browsers and devices signed in to your account."
              className="settings-row settings-row-expanded settings-sessions-row"
              trailing={authSessions.some((item) => !item.current) ? (
                <button className="settings-secondary-button" type="button" aria-label="Log out other sessions" title="Log out other sessions" disabled={sessionsBusyId !== null} onClick={handleRevokeOtherSessions}>
                  <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
                </button>
              ) : null}
            >
              {sessionsLoading ? <p className="settings-field-message" role="status">Loading sessions…</p> : null}
              {sessionsError ? <p className="settings-field-message" role="alert">{sessionsError}</p> : null}
              {!sessionsLoading && !sessionsError && authSessions.length === 0 ? <p className="settings-field-message">No active sessions found.</p> : null}
              {!sessionsLoading && !sessionsError && authSessions.length > 0 ? (
                <div className="settings-sessions-list">
                  {authSessions.map((item) => (
                    <div className="settings-session-item" key={item.id}>
                      <div className="settings-session-copy">
                        <strong>{item.device_label} · {item.browser || 'Browser unavailable'}</strong>
                        <span>{item.operating_system || 'Operating system unavailable'}</span>
                        <small>Logged in {formatSessionDate(item.created_at)} · Last active {formatSessionDate(item.last_active_at)}</small>
                      </div>
                      {item.current ? <span className="settings-session-current">Current session</span> : (
                        <button className="settings-secondary-button" type="button" aria-label={sessionsBusyId === item.id ? 'Logging out' : 'Log out'} title={sessionsBusyId === item.id ? 'Logging out' : 'Log out'} disabled={sessionsBusyId !== null} onClick={() => handleSessionRevoke(item.id)}>
                          <i className={`fa-solid ${sessionsBusyId === item.id ? 'fa-spinner fa-spin' : 'fa-right-from-bracket'}`} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
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
              trailing={<Link className="settings-secondary-button settings-subscription-link" href="/subscriptions" aria-label="View plans" title="View plans"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></Link>}
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
              trailing={<button className="settings-secondary-button settings-upload-trigger" type="button" aria-label="Upload profile picture" title="Upload profile picture" onClick={() => profilePictureInputRef.current?.click()}><i className="fa-solid fa-upload" aria-hidden="true" /></button>}
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
              trailing={<SaveTickButton disabled={!canUpdatePrivacy} busy={isUpdatingPrivacy} onClick={handlePrivacyUpdate} label="Update private profile" />}
            >
              <SettingsToggle value={privacyDraft} onChange={setPrivacyDraft} disabled={isUpdatingPrivacy} />
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-check-double" aria-hidden="true" /></span>}
              title="Read receipts"
              subtitle="Show when messages have been read. This setting is mutual with the other person."
              className="settings-row"
              trailing={<SaveTickButton disabled={!canUpdateReadReceipts} busy={isUpdatingReadReceipts} onClick={handleReadReceiptsUpdate} label="Update read receipts" />}
            >
              <SettingsToggle value={readReceiptsDraft} onChange={setReadReceiptsDraft} disabled={isUpdatingReadReceipts} />
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-regular fa-heart" aria-hidden="true" /></span>}
              title="Show my Likes"
              subtitle="Let signed-in people see your liked posts and identify you in Like lists. Like counts remain public when this is off."
              className="settings-row"
              trailing={<SaveTickButton disabled={!canUpdateLikesVisible} busy={isUpdatingLikesVisible} onClick={handleLikesVisibleUpdate} label="Update Like visibility" />}
            >
              <SettingsToggle value={likesVisibleDraft} onChange={setLikesVisibleDraft} disabled={isUpdatingLikesVisible} />
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></span>}
              title="Direct messages"
              subtitle="You can message people who follow you back."
              className="settings-row"
              trailing={<SaveTickButton disabled={!canUpdateDirectMessages} busy={false} onClick={() => { setDirectMessagesSaved(directMessagesDraft); onToast?.('Direct messages setting updated.', 'success'); }} label="Update direct messages" />}
            >
              <SettingsToggle value={directMessagesDraft} onChange={setDirectMessagesDraft} />
            </SettingsRow>

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-ban" aria-hidden="true" /></span>}
              title="Blocked people"
              subtitle="Review and unblock people you have blocked."
              className="settings-row"
              trailing={<button className="settings-update-button" type="button" aria-label="View blocked people" title="View blocked people" onClick={() => setBlockedOpen(true)}><i className="fa-solid fa-eye" aria-hidden="true" /></button>}
            />

            <SettingsRow
              icon={<span className="settings-icon"><i className="fa-solid fa-at" aria-hidden="true" /></span>}
              title="Mentions"
              subtitle="Control who can mention you in conversations."
              className="settings-row"
              trailing={<SaveTickButton disabled={!canUpdateMentions} busy={false} onClick={() => { setMentionsSaved(mentionsDraft); onToast?.('Mentions setting updated.', 'success'); }} label="Update mentions" />}
            >
              <SettingsToggle value={mentionsDraft} onChange={setMentionsDraft} />
            </SettingsRow>
          </div>
        </div>
      )}
      {blockedOpen && <Modal title="Blocked people" onClose={() => setBlockedOpen(false)}><input className="settings-field-input" value={blockedQuery} onChange={(event) => setBlockedQuery(event.target.value)} placeholder="Search blocked people" aria-label="Search blocked people" />{blockedUsers.length === 0 && !blockedLoading ? <p>Not found.</p> : blockedUsers.map((item) => <ListRow key={item.id} avatar={<ProfileCard href={`/${encodeURIComponent(item.username)}/posts`} name={item.displayName} handle={`@${item.username}`} tone="mint" initials={item.displayName.slice(0, 2).toUpperCase()} imageUrl={item.profilePictureUrl} />} title={item.displayName} subtitle={`@${item.username}`} trailing={<button className="settings-update-button" type="button" aria-label={`Unblock ${item.displayName}`} title={`Unblock ${item.displayName}`} onClick={() => setUnblockTarget(item)}><i className="fa-solid fa-unlock" aria-hidden="true" /></button>} />)}{blockedCursor && <div ref={blockedLoadMoreRef} aria-live="polite">{blockedLoading ? 'Loading…' : null}</div>}{unblockTarget && <Modal title="Unblock user" onClose={() => setUnblockTarget(null)} actions={<><button className="button-secondary" type="button" onClick={() => setUnblockTarget(null)}>Cancel</button><button className="button-primary" type="button" onClick={async () => { const session = loadAuthSession(); if (!session) return; await unblockUser(session.accessToken, unblockTarget.username); setBlockedUsers((items) => items.filter((item) => item.id !== unblockTarget.id)); setUnblockTarget(null); }}>Unblock</button></>}><p>Unblocking does not restore follows or previous access.</p></Modal>}</Modal>}
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
