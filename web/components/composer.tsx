"use client";

import { type ChangeEvent, type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProfileCard } from '@/components/profile-card';
import { ActionMenu } from '@/components/action-menu';
import { MentionInput } from '@/components/mention-input';
import { Modal } from '@/components/modal';
import Cropper from 'react-easy-crop';
import { createCroppedImage, type CropPixels } from '@/lib/crop-image';

type ComposerMedia = {
  id: string;
  file: File;
  url: string;
};

function ComposerMediaStrip({ media, onOpen, onRemove, onReorder }: { media: ComposerMedia[]; onOpen: (index: number) => void; onRemove: (id: string) => void; onReorder: (draggedId: string, targetId: string) => void }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (!media.length) return null;

  return (
    <div className="composer-media-strip" aria-label={`${media.length} image${media.length === 1 ? '' : 's'} attached`}>
      {media.map((item, index) => (
        <div
          className={`composer-media-item${draggedId === item.id ? ' is-dragging' : ''}`}
          key={item.id}
          draggable
          onDragStart={(event) => {
            setDraggedId(item.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData('text/plain') || draggedId;
            if (sourceId && sourceId !== item.id) onReorder(sourceId, item.id);
            setDraggedId(null);
          }}
          onDragEnd={() => setDraggedId(null)}
        >
          <button className="composer-media-preview" type="button" onClick={() => onOpen(index)} aria-label={`Preview image ${index + 1}`}>
            <img src={item.url} alt="" />
          </button>
          <button className="composer-media-remove" type="button" onClick={() => onRemove(item.id)} aria-label={`Remove image ${index + 1}`} title="Remove image" draggable={false}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

type ComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>, media: File[]) => void | false | Promise<void | false>;
  disabled?: boolean;
  busy?: boolean;
  multiline?: boolean;
  placeholder?: string;
  disabledPlaceholder?: string;
  inputLabel?: string;
  sendLabel?: string;
  maxLength?: number;
  draftStorageKey?: string;
  showCount?: boolean;
  allowEmptySubmit?: boolean;
  contextLabel?: string | null;
  onClearContext?: () => void;
  referencedPreview?: {
    name: string;
    handle: string;
    initials: string;
    tone: string;
    imageUrl?: string | null;
    text: string;
    mediaCount?: number;
  } | null;
  enableMentions?: boolean;
};

export function Composer({
  draft,
  onDraftChange,
  onSend,
  disabled = false,
  busy = false,
  multiline = false,
  placeholder = 'Write a message...',
  disabledPlaceholder = 'Chat unavailable',
  inputLabel = 'Message',
  sendLabel = 'Send message',
  maxLength,
  draftStorageKey,
  showCount = false,
  allowEmptySubmit = false,
  contextLabel = null,
  onClearContext,
  referencedPreview = null,
  enableMentions = false,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<ComposerMedia[]>([]);
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropPixels | null>(null);
  const [cropBusy, setCropBusy] = useState(false);
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const characterCount = draft.length;
  const isOverLimit = typeof maxLength === 'number' && characterCount > maxLength;
  const composerExpanded = expanded || media.length > 0;

  useEffect(() => {
    if (!draftStorageKey || typeof window === 'undefined') return;
    let savedDraft = '';
    try {
      savedDraft = window.localStorage.getItem(draftStorageKey) ?? '';
    } catch {
      savedDraft = '';
    }
    onDraftChange(savedDraft);
    setHydratedDraftKey(draftStorageKey);
  }, [draftStorageKey, onDraftChange]);

  useEffect(() => {
    if (!draftStorageKey || hydratedDraftKey !== draftStorageKey || typeof window === 'undefined') return;
    try {
      if (draft) window.localStorage.setItem(draftStorageKey, draft);
      else window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Draft persistence is best effort and must not interrupt composing.
    }
  }, [draft, draftStorageKey, hydratedDraftKey]);

  mediaRef.current = media;
  useEffect(() => () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  function handleMediaSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    setMediaError('');
    if (!selectedFiles.length) return;

    const availableSlots = 8 - media.length;
    const filesToAdd = selectedFiles.slice(0, availableSlots);
    if (filesToAdd.length < selectedFiles.length) setMediaError('You can attach up to 8 images to a post.');

    setMedia((current) => [
      ...current,
      ...filesToAdd.map((file, index) => ({ id: `${Date.now()}-${index}-${file.name}`, file, url: URL.createObjectURL(file) })),
    ]);
  }

  function removeMedia(id: string) {
    setMedia((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((entry) => entry.id !== id);
    });
    setMediaError('');
    setCropIndex(null);
  }

  function reorderMedia(draggedId: string, targetId: string) {
    setMedia((current) => {
      const fromIndex = current.findIndex((item) => item.id === draggedId);
      const toIndex = current.findIndex((item) => item.id === targetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function openCrop(index: number) {
    setCropIndex(index);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function resetCrop() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function changeCropImage(direction: -1 | 1) {
    if (cropIndex === null || media.length < 2) return;
    openCrop((cropIndex + direction + media.length) % media.length);
  }

  async function confirmCrop() {
    if (cropIndex === null || !croppedAreaPixels) return;
    const currentItem = media[cropIndex];
    if (!currentItem) return;

    setCropBusy(true);
    try {
      const croppedFile = await createCroppedImage(currentItem.url, croppedAreaPixels, currentItem.file.name);
      const croppedUrl = URL.createObjectURL(croppedFile);
      URL.revokeObjectURL(currentItem.url);
      setMedia((current) => current.map((item, index) => index === cropIndex ? { ...item, file: croppedFile, url: croppedUrl } : item));
      setCropIndex(null);
    } catch {
      setMediaError('Could not crop this image. Please try again.');
    } finally {
      setCropBusy(false);
    }
  }

  useLayoutEffect(() => {
    if (!multiline) {
      setExpanded(false);
      return;
    }

    setExpanded(draft.length > 0);
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const shouldExpand = draft.length > 0 && (draft.includes('\n') || textarea.scrollHeight > 44);
    textarea.style.height = shouldExpand ? `${Math.min(textarea.scrollHeight, 96)}px` : '2.5rem';
    setExpanded(shouldExpand);
  }, [draft, multiline]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const canSubmitWithoutText = allowEmptySubmit || media.length > 0;
    if (disabled || (!canSubmitWithoutText && !draft.trim()) || isOverLimit) {
      event.preventDefault();
      return;
    }

    const result = await onSend(event, media.map((item) => item.file));
    if (result === false) return;
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    setMedia([]);
    setCropIndex(null);
  }

  return (
    <div className="composer-stack">
      {contextLabel ? <div className="composer-context-label">{contextLabel}</div> : null}
      {referencedPreview ? (
        <div className="composer-quoted-preview">
          <ProfileCard name={referencedPreview.name} handle={referencedPreview.handle} tone={referencedPreview.tone} initials={referencedPreview.initials} imageUrl={referencedPreview.imageUrl} />
          {onClearContext ? <button className="composer-context-close" type="button" onClick={onClearContext} aria-label="Remove quoted post" title="Remove quoted post"><i className="fa-solid fa-xmark" aria-hidden="true" /></button> : null}
          <p className="composer-quoted-preview-text">{referencedPreview.text}</p>
          {referencedPreview.mediaCount ? <span className="composer-quoted-preview-media">Media attached</span> : null}
        </div>
      ) : null}
      <form
        className={`composer floating-bar-composer${multiline ? ' floating-bar-composer-multiline' : ''}${composerExpanded ? ' floating-bar-composer-expanded' : ''}`}
        onSubmit={handleSubmit}
      >
        <div className="composer-attachment-menu">
          <button
            ref={attachmentButtonRef}
            className="icon-plain"
            type="button"
            aria-label="Add to post"
            aria-haspopup="menu"
            aria-expanded={attachmentMenuOpen}
            disabled={disabled}
            onClick={() => setAttachmentMenuOpen((open) => !open)}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />
          </button>
          <ActionMenu
            open={attachmentMenuOpen}
            ariaLabel="Add to post"
            anchorRef={attachmentButtonRef}
            align="start"
            onClose={() => setAttachmentMenuOpen(false)}
            items={[
              { label: 'Add media', icon: 'fa-image', onClick: () => { setAttachmentMenuOpen(false); if (multiline) mediaInputRef.current?.click(); } },
              { label: 'Add link', icon: 'fa-link', onClick: () => setAttachmentMenuOpen(false) },
            ]}
          />
          {multiline ? <input ref={mediaInputRef} className="composer-media-input" type="file" accept="image/*" multiple onChange={handleMediaSelection} aria-label="Choose images to attach" /> : null}
        </div>
        {multiline ? <ComposerMediaStrip media={media} onOpen={openCrop} onRemove={removeMedia} onReorder={reorderMedia} /> : null}
        {enableMentions ? (
          <MentionInput
            value={draft}
            onChange={onDraftChange}
            placeholder={disabled ? disabledPlaceholder : placeholder}
            ariaLabel={inputLabel}
            disabled={disabled}
            maxLength={maxLength}
            multiline={multiline}
          />
        ) : multiline ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(maxLength ? event.target.value.slice(0, maxLength) : event.target.value)}
            placeholder={disabled ? disabledPlaceholder : placeholder}
            aria-label={inputLabel}
            disabled={disabled}
            rows={1}
            maxLength={maxLength}
          />
        ) : (
          <input
            value={draft}
            onChange={(event) => onDraftChange(maxLength ? event.target.value.slice(0, maxLength) : event.target.value)}
            placeholder={disabled ? disabledPlaceholder : placeholder}
            aria-label={inputLabel}
            disabled={disabled}
            maxLength={maxLength}
          />
        )}
        {showCount && typeof maxLength === 'number' && (
          <span className="composer-inline-count" aria-live="polite">
            {characterCount}/{maxLength}
          </span>
        )}
        <button className="composer-send" type="submit" disabled={disabled || busy || ((!allowEmptySubmit && media.length === 0) && !draft.trim()) || isOverLimit} aria-label={busy ? 'Posting…' : sendLabel} aria-busy={busy}>
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-arrow-up'}`} aria-hidden="true" />
        </button>
      </form>
      {mediaError ? <p className="composer-media-error" role="status">{mediaError}</p> : null}
      {cropIndex !== null && media[cropIndex] ? (
        <Modal title="Crop image" onClose={() => setCropIndex(null)} closeLabel="Cancel crop" actions={
          <>
            <button className="settings-secondary-button" type="button" disabled={cropBusy} onClick={resetCrop}>Reset</button>
            <button className="settings-update-button" type="button" disabled={cropBusy || !croppedAreaPixels} onClick={confirmCrop}><i className={`fa-solid ${cropBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} aria-hidden="true" /><span>{cropBusy ? 'Cropping…' : 'Apply crop'}</span></button>
          </>
        }>
          <div className="composer-media-crop-stage">
            {media.length > 1 ? <button className="composer-media-crop-arrow composer-media-crop-arrow-previous" type="button" disabled={cropBusy} onClick={() => changeCropImage(-1)} aria-label="Previous image" title="Previous image"><i className="fa-solid fa-chevron-left" aria-hidden="true" /></button> : null}
            <Cropper image={media[cropIndex].url} crop={crop} zoom={zoom} aspect={3 / 5} cropShape="rect" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)} />
            {media.length > 1 ? <button className="composer-media-crop-arrow composer-media-crop-arrow-next" type="button" disabled={cropBusy} onClick={() => changeCropImage(1)} aria-label="Next image" title="Next image"><i className="fa-solid fa-chevron-right" aria-hidden="true" /></button> : null}
          </div>
          <label className="profile-picture-zoom"><span>Zoom</span><input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        </Modal>
      ) : null}
    </div>
  );
}
