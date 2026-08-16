"use client";

import type { AuthUser } from '@/lib/auth';

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

type ProfileCardProps = {
  user: AuthUser;
};

export function ProfileCard({ user }: ProfileCardProps) {
  return (
    <div className="profile-card">
      <span className="profile-card-avatar user-avatar avatar-mint">{getInitials(user.name)}</span>
      <div className="profile-card-info">
        <strong>{user.name}</strong>
        <span className="profile-card-handle">@{user.username}</span>
      </div>
    </div>
  );
}
