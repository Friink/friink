'use client';

import Cropper from 'react-easy-crop';
import { Modal } from '@/components/modal';
import type { CropPixels } from '@/lib/crop-image';

type ProfilePictureCropModalProps = {
  source: string;
  crop: { x: number; y: number };
  zoom: number;
  maxZoom: number;
  croppedAreaPixels: CropPixels | null;
  busy: boolean;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (pixels: CropPixels) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ProfilePictureCropModal({ source, crop, zoom, maxZoom, busy, onCropChange, onZoomChange, onCropComplete, onCancel, onConfirm }: ProfilePictureCropModalProps) {
  return (
    <Modal title="Crop profile picture" onClose={onCancel} onBack={onCancel} backLabel="Back to profile picture" closeLabel="Cancel crop" className="profile-picture-crop-dialog" actions={
      <>
        <button className="settings-secondary-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className="settings-update-button" type="button" disabled={busy} onClick={onConfirm} aria-label="Upload profile picture" title="Upload profile picture"><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`} aria-hidden="true" /></button>
      </>
    }>
      <p className="profile-picture-crop-help">Drag the image and adjust the zoom to choose a square crop.</p>
      <div className="profile-picture-crop-stage">
        <Cropper
          image={source}
          crop={crop}
          zoom={zoom}
          maxZoom={maxZoom}
          aspect={1}
          cropShape="rect"
          showGrid
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={(_, pixels) => onCropComplete(pixels)}
        />
      </div>
      <label className="profile-picture-zoom"><span>Zoom</span><input type="range" min={1} max={maxZoom} step={0.05} value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} /></label>
    </Modal>
  );
}
