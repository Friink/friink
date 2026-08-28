"use client";

import type { FormEvent } from 'react';

type ChatComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
};

export function ChatComposer({ draft, onDraftChange, onSend, disabled = false }: ChatComposerProps) {
  return (
    <form className="chat-composer floating-bar-composer" onSubmit={onSend}>
      <button className="icon-plain" type="button" aria-label="Attach file" disabled={disabled}>
        <i className="fa-solid fa-paperclip" aria-hidden="true" />
      </button>
      <input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={disabled ? 'Chat unavailable' : 'Write a message...'}
        aria-label="Message"
        disabled={disabled}
      />
      <button className="chat-send" type="submit" disabled={disabled || !draft.trim()} aria-label="Send message">
        <i className="fa-solid fa-arrow-up" aria-hidden="true" />
      </button>
    </form>
  );
}
