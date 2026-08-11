import type { InputHTMLAttributes, ReactNode } from 'react';

type PillFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  trailing?: ReactNode;
};

export function PillField({ label, trailing, ...props }: PillFieldProps) {
  return (
    <label className="pill-field">
      <span className="sr-only">{label}</span>
      <input {...props} aria-label={label} />
      {trailing}
    </label>
  );
}
