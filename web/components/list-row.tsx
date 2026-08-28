"use client";

import type { ReactNode } from 'react';

type ListRowProps = {
  avatar: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  unread?: boolean;
  className?: string;
};

export function ListRow({ avatar, title, subtitle, meta, trailing, onClick, ariaLabel, unread = false, className = '' }: ListRowProps) {
  const rowClassName = `list-row${unread ? ' list-row-unread' : ''}${className ? ` ${className}` : ''}`;
  const content = (
    <>
      <span className="list-row-avatar">{avatar}</span>
      <span className="list-row-copy">
        <span className="list-row-header">
          <strong>{title}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
        {subtitle ? <span className="list-row-subtitle">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="list-row-trailing">{trailing}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        className={rowClassName}
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  return <article className={rowClassName}>{content}</article>;
}
