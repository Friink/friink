"use client";

export function ProfileBadge({ label }: { label: string }) {
  return <span className="professional-profile-badge" title={label}>{label}</span>;
}
