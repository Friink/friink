"use client";

import { type FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { ProfileCard } from '@/components/profile-card';

type ComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  disabledPlaceholder?: string;
  inputLabel?: string;
  sendLabel?: string;
  maxLength?: number;
  showCount?: boolean;
  allowEmptySubmit?: boolean;
  contextLabel?: string | null;
  referencedPreview?: {
    name: string;
    handle: string;
    initials: string;
    tone: string;
    text: string;
    mediaCount?: number;
  } | null;
};

export function Composer({
  draft,
  onDraftChange,
  onSend,
  disabled = false,
  multiline = false,
  placeholder = 'Write a message...',
  disabledPlaceholder = 'Chat unavailable',
  inputLabel = 'Message',
  sendLabel = 'Send message',
  maxLength,
  showCount = false,
  allowEmptySubmit = false,
  contextLabel = null,
  referencedPreview = null,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const characterCount = draft.length;
  const isOverLimit = typeof maxLength === 'number' && characterCount > maxLength;

  useLayoutEffect(() => {
    if (!multiline || !textareaRef.current) return;

    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const shouldExpand = draft.length > 0 && (draft.includes('\n') || textarea.scrollHeight > 44);
    textarea.style.height = shouldExpand ? `${Math.min(textarea.scrollHeight, 96)}px` : '2.5rem';
    setExpanded(shouldExpand);
  }, [draft, multiline]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (disabled || (!allowEmptySubmit && !draft.trim()) || isOverLimit) {
      event.preventDefault();
      return;
    }

    onSend(event);
  }

  return (
    <div className="composer-stack">
      {contextLabel ? <div className="composer-context-label">{contextLabel}</div> : null}
      {referencedPreview ? (
        <div className="composer-quoted-preview">
          <ProfileCard name={referencedPreview.name} handle={referencedPreview.handle} tone={referencedPreview.tone} initials={referencedPreview.initials} />
          <p className="composer-quoted-preview-text">{referencedPreview.text}</p>
          {referencedPreview.mediaCount ? <span className="composer-quoted-preview-media">Media attached</span> : null}
        </div>
      ) : null}
      <form
        className={`composer floating-bar-composer${multiline ? ' floating-bar-composer-multiline' : ''}${expanded ? ' floating-bar-composer-expanded' : ''}`}
        onSubmit={handleSubmit}
      >
        <button className="icon-plain" type="button" aria-label="Attach file" disabled={disabled}>
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
        {multiline ? (
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
        <button className="composer-send" type="submit" disabled={disabled || (!allowEmptySubmit && !draft.trim()) || isOverLimit} aria-label={sendLabel}>
          <i className="fa-solid fa-arrow-up" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
