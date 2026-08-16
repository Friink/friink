import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'brand' | 'quiet';
};

export function Button({ className = '', variant = 'brand', ...props }: ButtonProps) {
  return <button className={`pill-button pill-button-${variant} ${className}`.trim()} {...props} />;
}
