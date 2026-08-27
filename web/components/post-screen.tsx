'use client';
import { ProfileCard } from '@/components/profile-card';
import type { AuthUser } from '@/lib/auth';

type PostScreenProps = {
  user: AuthUser;
  text: string;
  onTextChange: (text: string) => void;
  quotedPost?: {
    handle: string;
    text: string;
    unavailable?: boolean;
  } | null;
  errorMessage?: string;
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

export function PostScreen({ user, text, onTextChange, quotedPost, errorMessage = '' }: PostScreenProps) {
  return (
    <section className="post-screen">
      <div className="chat-header">
        <ProfileCard name={user.name} handle={`@${user.username}`} tone="mint" initials={getInitials(user.name)} />
      </div>

      <div className="post-composer">
        <div className="post-composer-body">
          {/* user identity moved to header */}
          {errorMessage && <p className="login-error" role="alert">{errorMessage}</p>}
          <textarea
            autoFocus
            maxLength={512}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="What's on your mind?"
          />
          {quotedPost && (
            <div className={`feed-post-quote post-screen-quote${quotedPost.unavailable ? ' feed-post-quote-unavailable' : ''}`}>
              <strong>{quotedPost.unavailable ? 'Original post unavailable' : quotedPost.handle}</strong>
              <p>{quotedPost.text}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
