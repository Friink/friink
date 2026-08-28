"use client";

import { type FormEvent, useLayoutEffect, useRef, useState } from 'react';

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
    if (disabled || !draft.trim() || isOverLimit) {
      event.preventDefault();
      return;
    }

    onSend(event);
  }

  return (
    <div className="composer-shell">
      <form
        className={`composer floating-bar-composer${multiline ? ' floating-bar-composer-multiline' : ''}${expanded ? ' floating-bar-composer-expanded' : ''}`}
        onSubmit={handleSubmit}
      >
        <button className="icon-plain" type="button" aria-label="Attach file" disabled={disabled}>
          <i className="fa-solid fa-paperclip" aria-hidden="true" />
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
        <button className="composer-send" type="submit" disabled={disabled || !draft.trim() || isOverLimit} aria-label={sendLabel}>
          <i className="fa-solid fa-arrow-up" aria-hidden="true" />
        </button>
      </form>
      {showCount && typeof maxLength === 'number' && (
        <span className="composer-count" aria-live="polite">
          {characterCount}/{maxLength}
        </span>
      )}
    </div>
  );
}
