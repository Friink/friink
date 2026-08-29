"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type PageSurfaceProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  variant?: 'list' | 'stack';
};

export const PageSurface = forwardRef<HTMLElement, PageSurfaceProps>(function PageSurface(
  { children, className = '', variant = 'stack', ...props },
  ref,
) {
  const surfaceClassName = `page-surface page-surface-${variant}${className ? ` ${className}` : ''}`;
  return (
    <section ref={ref} className={surfaceClassName} {...props}>
      {children}
    </section>
  );
});
