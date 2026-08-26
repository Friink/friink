'use client';
import { ProfileCard } from '@/components/profile-card';
import type { AuthUser } from '@/lib/auth';

type PostScreenProps = {
  user: AuthUser;
  text: string;
  onTextChange: (text: string) => void;
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

export function PostScreen({ user, text, onTextChange }: PostScreenProps) {
  return (
    <section className="post-screen">
      <div className="chat-header">
        <ProfileCard user={user} />
      </div>

      <div className="post-composer">
        <div className="post-composer-body">
          {/* user identity moved to header */}
          <textarea
            autoFocus
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="What's on your mind?"
          />
        </div>
      </div>
    </section>
  );
}
