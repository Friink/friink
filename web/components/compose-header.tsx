"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

type ComposeHeaderProps = {
  name: string;
  handle: string;
  initials?: string;
  tone?: string;
  onBack?: () => void;
  onOptions?: () => void;
};

export function ComposeHeader({ name, handle, initials = '', tone = 'mint', onBack }: ComposeHeaderProps) {
  const router = useRouter();
  const goBack = () => {
    if (typeof onBack === 'function') onBack();
    else router.back();
  };

  return (
    <div className="chat-header">
      <button className="icon-plain" type="button" onClick={goBack} aria-label="Back">
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
      </button>
      <span className={`user-avatar avatar-${tone}`}>{initials}</span>
      <div className="chat-contact">
        <strong>{name}</strong>
        <span>{handle}</span>
      </div>
      <button className="icon-plain chat-more" type="button" aria-label="Conversation options">
        <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
      </button>
    </div>
  );
}

export default ComposeHeader;
