"use client";

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
};

export function ProfileCard({ name, handle, tone = 'mint', initials, date }: ProfileCardProps) {
  return (
    <div className="profile-card">
      <span className={`profile-card-avatar user-avatar avatar-${tone}`}>{initials ?? getInitials(name)}</span>
      <div className="profile-card-info">
        <strong>{name}</strong>
        <span className="profile-card-handle">{handle}</span>
        {date && <span className="profile-card-date">{date}</span>}
      </div>
    </div>
  );
}
