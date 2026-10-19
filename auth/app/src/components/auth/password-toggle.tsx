"use client";

export default function PasswordToggle({ visible, label, onClick }: { visible: boolean; label: string; onClick: () => void }) {
  return (
    <button className="password-toggle" type="button" aria-label={label} aria-pressed={visible} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 8.8 4 10 6a18 18 0 0 1-3.2 3.4" /><path d="M6.2 6.2A18 18 0 0 0 2 10c1.2 2 4.8 6 10 6 1 0 2-.2 2.8-.5" /></> : <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>}
      </svg>
    </button>
  );
}
