'use client';

import { useState } from 'react';
import { currentUser } from '@/lib/data';

type PostScreenProps = {
  onBack: () => void;
  onPost: (text: string) => void;
};

export function PostScreen({ onBack, onPost }: PostScreenProps) {
  const [text, setText] = useState('');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onPost(trimmed);
    setText('');
  }

  return (
    <form className="post-screen" onSubmit={handleSubmit}>
      <div className="post-screen-header">
        <button className="icon-plain" type="button" onClick={onBack} aria-label="Go back">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </button>
        <h2>Compose</h2>
        <div className="post-screen-actions">
          <button className="post-option" type="button" aria-label="Post settings" title="Post settings">
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </button>
          <button className="post-option" type="button" aria-label="Attach file" title="Attach file">
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
          </button>
          <button className="primary-button post-submit" type="submit" disabled={!text.trim()}>
            Post
          </button>
        </div>
      </div>

      <div className="post-composer">
        <div className="post-composer-body">
          <div className="post-composer-identity">
            <span className={`user-avatar avatar-${currentUser.tone}`}>{currentUser.initials}</span>
            <div>
              <strong>{currentUser.name}</strong>
              <span>{currentUser.handle}</span>
            </div>
          </div>
          <textarea
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What's on your mind?"
          />
        </div>
      </div>

    </form>
  );
}
