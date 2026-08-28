"use client";

import type { FormEvent } from 'react';

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
  return (
    <form className={`composer floating-bar-composer${multiline ? ' floating-bar-composer-multiline' : ''}`} onSubmit={onSend}>
      <button className="icon-plain" type="button" aria-label="Attach file" disabled={disabled}>
        <i className="fa-solid fa-paperclip" aria-hidden="true" />
      </button>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={disabled ? disabledPlaceholder : placeholder}
          aria-label={inputLabel}
          disabled={disabled}
          rows={2}
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
      <button className="chat-send" type="submit" disabled={disabled || !draft.trim()} aria-label={sendLabel}>
        <i className="fa-solid fa-arrow-up" aria-hidden="true" />
      </button>
    </form>
  );
}
