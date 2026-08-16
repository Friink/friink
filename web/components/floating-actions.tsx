"use client";

import React from 'react';

type FloatingActionsProps = {
  children?: React.ReactNode;
  className?: string;
  visible?: boolean;
};

export function FloatingActions({ children, className = '', visible = true }: FloatingActionsProps) {
  if (!visible) return null;

  return (
    <div className={`floating-actions ${className}`.trim()}>
      {children}
    </div>
  );
}
