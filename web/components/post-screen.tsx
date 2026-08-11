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
        <h2>New post</h2>
        <button className="primary-button post-submit" type="submit" disabled={!text.trim()}>
          Post
        </button>
      </div>

      <div className="post-composer">
        <span className={`user-avatar avatar-${currentUser.tone}`}>{currentUser.initials}</span>
        <div className="post-composer-body">
          <strong>{currentUser.name}</strong>
          <span>{currentUser.handle}</span>
          <textarea
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What's on your mind?"
            maxLength={280}
          />
          <p className="char-count">{text.length}/280</p>
        </div>
      </div>
    </form>
  );
}
