"use client";

import Link from 'next/link';
import { ProfileBadge } from '@/components/profile-badge';

export const DEFAULT_PROFILE_IMAGE = '/media/profile.jpg';

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
  name: string;
  handle: string;
  tone?: string;
  initials?: string;
  date?: string;
  href?: string;
  imageUrl?: string | null;
  showProfessionalBadge?: boolean;
  showRegisteredBadge?: boolean;
};

export function ProfileCard({ name, handle, tone = 'mint', initials, date, href, imageUrl, showProfessionalBadge = false, showRegisteredBadge = false }: ProfileCardProps) {
  const resolvedImageUrl = imageUrl || DEFAULT_PROFILE_IMAGE;
  const visibleBadges = [
    ...(showProfessionalBadge ? [{ label: 'Professional', icon: 'fa-briefcase' }] : []),
    ...(showRegisteredBadge ? [{ label: 'Friink Registered', icon: 'fa-shield-halved' }] : []),
  ];
  const content = (
    <div className="profile-card">
      <span className={`profile-card-avatar user-avatar avatar-${tone} profile-card-avatar-image`}>
        <img src={resolvedImageUrl} alt="" />
      </span>
      <div className="profile-card-info">
        <span className="profile-card-name-row">
          <strong>{name}</strong>
          {visibleBadges.map((badge) => <ProfileBadge key={badge.label} label={badge.label} icon={badge.icon} />)}
        </span>
        <span className="profile-card-handle">{handle}</span>
        {date && <span className="profile-card-date">{date}</span>}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link className="profile-card-link" href={href} aria-label={`Open ${name} profile`}>
      {content}
    </Link>
  );
}
