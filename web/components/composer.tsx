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
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    if (!multiline || !textareaRef.current) return;

    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    const shouldExpand = draft.length > 0 && (draft.includes('\n') || textarea.scrollHeight > 44);
    textarea.style.height = shouldExpand ? `${Math.min(textarea.scrollHeight, 96)}px` : '2.5rem';
    setExpanded(shouldExpand);
  }, [draft, multiline]);

  return (
    <form
      className={`composer floating-bar-composer${multiline ? ' floating-bar-composer-multiline' : ''}${expanded ? ' floating-bar-composer-expanded' : ''}`}
      onSubmit={onSend}
    >
      <button className="icon-plain" type="button" aria-label="Attach file" disabled={disabled}>
        <i className="fa-solid fa-paperclip" aria-hidden="true" />
      </button>
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={disabled ? disabledPlaceholder : placeholder}
          aria-label={inputLabel}
          disabled={disabled}
          rows={1}
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={disabled ? disabledPlaceholder : placeholder}
          aria-label={inputLabel}
          disabled={disabled}
        />
      )}
      <button className="composer-send" type="submit" disabled={disabled || !draft.trim()} aria-label={sendLabel}>
        <i className="fa-solid fa-arrow-up" aria-hidden="true" />
      </button>
    </form>
  );
}
