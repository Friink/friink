"use client";

import { createPortal } from 'react-dom';
import { useEffect, useId, useState, type ReactNode } from 'react';

type ModalProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  closeLabel?: string;
  backLabel?: string;
  className?: string;
};

export function Modal({ title, children, actions, onClose, onBack, closeLabel = 'Close', backLabel = 'Back', className = '' }: ModalProps) {
  const titleId = useId();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const modal = (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal-dialog${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          {onBack ? <button className="modal-back" type="button" aria-label={backLabel} title={backLabel} onClick={onBack}><i className="fa-solid fa-arrow-left" aria-hidden="true" /></button> : <span aria-hidden="true" />}
          <h2 id={titleId}>{title}</h2>
          <button className="modal-close" type="button" aria-label={closeLabel} onClick={onClose}>×</button>
        </header>
        <div className="modal-body">{children}</div>
        {actions ? <footer className="modal-actions">{actions}</footer> : null}
      </section>
    </div>
  );

  return portalRoot ? createPortal(modal, portalRoot) : null;
}
