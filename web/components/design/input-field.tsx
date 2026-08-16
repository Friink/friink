import type { InputHTMLAttributes, ReactNode } from 'react';

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  trailing?: ReactNode;
  prefix?: ReactNode;
};

export function InputField({ label, trailing, prefix, ...props }: InputFieldProps) {
  return (
    <label className={`pill-field ${prefix ? 'has-prefix' : ''}`}>
      <span className="sr-only">{label}</span>
      {prefix ? <span className="pill-field-prefix">{prefix}</span> : null}
      <input {...props} aria-label={label} />
      {trailing}
    </label>
  );
}
