"use client";

import React from 'react';

type ContentBoxProps = {
  children: React.ReactNode;
  className?: string;
};

export function ContentBox({ children, className = '' }: ContentBoxProps) {
  return (
    <div className={`content-box ${className}`.trim()}>
      {children}
    </div>
  );
}
