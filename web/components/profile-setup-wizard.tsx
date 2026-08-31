'use client';

import { useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Modal } from '@/components/modal';
import { createCroppedImage, getImageDimensions, type CropPixels } from '@/lib/crop-image';
import { compressImage, ImageCompressionError, validateImageFile } from '@/lib/image-compression';
import { AuthApiError, loadAuthSession, saveAuthSession, updateCurrentUser, updateProfileSetup, uploadProfilePicture, type AuthUser } from '@/lib/auth';

type ProfileSetupWizardProps = {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
  onToast?: (message: string) => void;
};

export function ProfileSetupWizard({ user, onUserChange, onToast }: ProfileSetupWizardProps) {
  const [open, setOpen] = useState(!user.setupCompleted);
  const [step, setStep] = useState<1 | 2>(user.setupStep);
  const [about, setAbout] = useState(user.about);
  const [busy, setBusy] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropPixels | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function applyUser(nextUser: AuthUser) {
    const session = loadAuthSession();
    if (session) saveAuthSession({ ...session, user: nextUser });
    onUserChange(nextUser);
  }

  async function saveSetup(nextStep: 1 | 2, completed = false) {
    const session = loadAuthSession();
    if (!session) return false;
    const nextUser = await updateProfileSetup(session.accessToken, { step: nextStep, completed });
    applyUser(nextUser);
    setStep(nextStep);
    return true;
  }

  async function handleClose() {
    if (busy) return;
    try {
      await saveSetup(step);
    } catch {
      onToast?.('Could not save your setup progress. Please try again.');
    } finally {
      // Closing is a local UI action. If persistence is unavailable, do not
      // trap the user inside the setup modal; the server will retain the last
      // successfully saved step for the next session.
      setOpen(false);
    }
  }

  async function handleSkip() {
    setBusy(true);
    try {
      if (step === 1) {
        await saveSetup(2);
      } else {
        await saveSetup(2, true);
        setOpen(false);
      }
    } catch {
      onToast?.('Could not save your setup progress. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAboutNext() {
    const session = loadAuthSession();
    if (!session) return;
    setBusy(true);
    try {
      let nextUser = user;
      if (about !== user.about) {
        nextUser = await updateCurrentUser(session.accessToken, { about: about.trim() });
        applyUser(nextUser);
      }
      const completedUser = await updateProfileSetup(session.accessToken, { step: 2, completed: true });
      applyUser(completedUser);
      setOpen(false);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Could not update your About text.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePictureNext() {
    setBusy(true);
    try {
      await saveSetup(2);
    } catch {
      onToast?.('Could not save your setup progress. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      onToast?.(validationError);
      return;
    }
    try {
      const dimensions = await getImageDimensions(file);
      const shorterEdge = Math.min(dimensions.width, dimensions.height);
      if (shorterEdge < 128) {
        onToast?.('This image is too small — please choose a photo at least 128x128px.');
        return;
      }
      setCropFile(file);
      setCropSource(URL.createObjectURL(file));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setMaxZoom(Math.max(1, shorterEdge / 128));
      setCroppedAreaPixels(null);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'This image could not be read. Please choose another image.');
    }
  }

  function cancelCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    setCropFile(null);
  }

  async function confirmCrop() {
    if (!cropSource || !cropFile || !croppedAreaPixels || busy) return;
    const session = loadAuthSession();
    if (!session) return;
    setBusy(true);
    try {
      const croppedFile = await createCroppedImage(cropSource, croppedAreaPixels, cropFile.name);
      const compressedFile = await compressImage(croppedFile, 'avatar');
      const nextUser = await uploadProfilePicture(session.accessToken, compressedFile);
      applyUser(nextUser);
      cancelCrop();
      await saveSetup(2);
    } catch (error) {
      onToast?.(error instanceof AuthApiError || error instanceof ImageCompressionError || error instanceof Error ? error.message : 'Could not update your profile picture.');
    } finally {
      setBusy(false);
    }
  }

  if (!open || user.setupCompleted) return null;

  return (
    <>
      <Modal
        title="Let's update your settings"
        onClose={handleClose}
        onBack={step === 2 ? () => setStep(1) : undefined}
        backLabel="Back to profile picture"
        closeLabel="Close setup"
        className="profile-setup-dialog"
        actions={
          <>
            <button className="settings-secondary-button" type="button" disabled={busy} onClick={handleSkip}>{step === 1 ? 'Skip' : 'Skip and finish'}</button>
            {step === 2 ? <button className="pill-button pill-button-brand" type="button" disabled={busy} onClick={handleAboutNext}>{busy ? 'Saving...' : 'Finish'}</button> : <button className="pill-button pill-button-brand" type="button" disabled={busy} onClick={handlePictureNext}>{busy ? 'Saving...' : 'Continue'}</button>}
          </>
        }
      >
        <p className="profile-setup-progress">Step {step} of 2</p>
        {step === 1 ? (
          <div className="profile-setup-step">
            <h3>Profile picture</h3>
            <p>Choose an optional picture so people can recognize you.</p>
            <div className="profile-setup-picture-preview">
              {user.profilePictureUrl ? <img src={user.profilePictureUrl} alt="" /> : <i className="fa-regular fa-user" aria-hidden="true" />}
            </div>
            <input ref={inputRef} className="profile-picture-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => handleFileSelected(event.target.files?.[0])} />
            <button className="settings-secondary-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Upload</button>
          </div>
        ) : (
          <div className="profile-setup-step">
            <h3>About</h3>
            <p>Add a short introduction to your profile.</p>
            <label className="settings-field">
              <span className="settings-field-label">About</span>
              <div className="settings-about-control">
                <textarea className="settings-about-field" value={about} maxLength={128} onChange={(event) => setAbout(event.target.value)} placeholder="About" />
                <span className="settings-field-count">{about.length}/128</span>
              </div>
            </label>
          </div>
        )}
      </Modal>

      {cropSource && (
        <Modal title="Crop profile picture" onClose={cancelCrop} onBack={cancelCrop} backLabel="Back to profile picture" closeLabel="Cancel crop" className="profile-picture-crop-dialog" actions={
          <>
            <button className="settings-secondary-button" type="button" disabled={busy} onClick={cancelCrop}>Cancel</button>
            <button className="settings-update-button" type="button" disabled={busy} onClick={confirmCrop} aria-label="Upload profile picture" title="Upload profile picture"><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`} aria-hidden="true" /></button>
          </>
        }>
          <p className="profile-picture-crop-help">Drag the image and adjust the zoom to choose a square crop.</p>
          <div className="profile-picture-crop-stage"><Cropper image={cropSource} crop={crop} zoom={zoom} maxZoom={maxZoom} aspect={1} cropShape="rect" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)} /></div>
          <label className="profile-picture-zoom"><span>Zoom</span><input type="range" min={1} max={maxZoom} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        </Modal>
      )}
    </>
  );
}
