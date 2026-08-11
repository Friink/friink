import type { ButtonHTMLAttributes } from 'react';

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'brand' | 'quiet';
};

export function PillButton({ className = '', variant = 'brand', ...props }: PillButtonProps) {
  return <button className={`pill-button pill-button-${variant} ${className}`.trim()} {...props} />;
}
