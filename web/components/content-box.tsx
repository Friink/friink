"use client";

import React from 'react';

type ContentBoxProps = {
  children: React.ReactNode;
};

export function ContentBox({ children }: ContentBoxProps) {
  return (
    <div className="content-box">
      {children}
    </div>
  );
}
