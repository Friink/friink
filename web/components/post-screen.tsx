'use client';

import { useState } from 'react';
import type { AuthUser } from '@/lib/auth';
import { ProfileCard } from '@/components/profile-card';

type PostScreenProps = {
  user: AuthUser;
  onBack: () => void;
  onPost: (text: string) => void;
};

function getInitials(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}

export function PostScreen({ user, onBack, onPost }: PostScreenProps) {
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
        <div className="post-screen-header-main">
          <div className="posting-as">Posting as</div>
          <ProfileCard user={user} />
        </div>
      </div>

      <div className="post-composer">
        <div className="post-composer-body">
          {/* user identity moved to header */}
          <textarea
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What's on your mind?"
          />
        </div>
      </div>
      <div className="post-footer">
        <div className="post-footer-left">
          <button className="post-option" type="button" aria-label="Post settings" title="Post settings">
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </button>
          <button className="post-option" type="button" aria-label="Attach file" title="Attach file">
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
          </button>
        </div>
        <div className="post-footer-right">
          <button className="primary-button post-submit" type="submit" disabled={!text.trim()}>
            Post
          </button>
        </div>
      </div>
    </form>
  );
}
