"use client";

export function ProfileBadge({ label, icon }: { label: string; icon: string }) {
  return <span className="professional-profile-badge" title={label} aria-label={label} role="img"><i className={`fa-solid ${icon}`} aria-hidden="true" /></span>;
}
