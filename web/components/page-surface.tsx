"use client";

import type { ReactNode } from 'react';

type PageSurfaceProps = {
  children: ReactNode;
  className?: string;
  variant?: 'list' | 'stack';
};

export function PageSurface({ children, className = '', variant = 'stack' }: PageSurfaceProps) {
  const surfaceClassName = `page-surface page-surface-${variant}${className ? ` ${className}` : ''}`;
  return <section className={surfaceClassName}>{children}</section>;
}
